"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { ACTION, ENTITY_TYPE, Prisma } from "@prisma/client";

import { createAuditLog } from "@/lib/create-audit-log";
import { createSafeAction } from "@/lib/create-safe-action";
import { db } from "@/lib/db";
import { isAssignableBoardMember } from "@/lib/boards/board-member-role";
import { logger } from "@/lib/logger";
import { requireBoardEditor } from "@/lib/permissions";
import { triggerCardCreated } from "@/lib/boards/realtime";

import { CreateSmartCaptureCard } from "./schema";
import { InputType, ReturnType } from "./types";

const normalizeDueDate = (value: InputType["dueDate"]) => {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
};

const normalizeChecklistItems = (items: string[]) => {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of items) {
    const title = item.replace(/\s+/g, " ").trim();
    const key = title.toLowerCase();

    if (!title || seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(title);
  }

  return result;
};

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId, orgId } = await auth();

  if (!userId || !orgId) {
    return { error: "Không có quyền truy cập." };
  }

  const {
    boardId,
    listId,
    title,
    description,
    dueDate,
    assigneeBoardMemberId,
    assigneeBoardMemberIds,
    labelIds,
  } = data;
  const requestedAssigneeIds = Array.from(
    new Set([
      ...assigneeBoardMemberIds,
      ...(assigneeBoardMemberId ? [assigneeBoardMemberId] : []),
    ]),
  );
  const checklistItems = normalizeChecklistItems(data.checklistItems);
  const dueDateValue = normalizeDueDate(dueDate);

  try {
    const permission = await requireBoardEditor({ boardId, orgId, userId });

    if (permission.error) {
      return { error: permission.error };
    }

    const list = await db.list.findFirst({
      where: {
        id: listId,
        archivedAt: null,
        board: {
          id: boardId,
          orgId,
        },
      },
      select: {
        id: true,
        title: true,
      },
    });

    if (!list) {
      return { error: "Không tìm thấy danh sách." };
    }

    const [assignees, labels] = await Promise.all([
      requestedAssigneeIds.length > 0
        ? db.boardMember.findMany({
            where: {
              id: {
                in: requestedAssigneeIds,
              },
              boardId,
              board: {
                orgId,
              },
            },
            select: {
              id: true,
              role: true,
            },
          })
        : [],
      labelIds.length > 0
        ? db.label.findMany({
            where: {
              id: {
                in: Array.from(new Set(labelIds)),
              },
              boardId,
              board: {
                orgId,
              },
            },
            select: {
              id: true,
            },
          })
        : [],
    ]);

    const validAssigneeIds = assignees
      .filter(isAssignableBoardMember)
      .map((assignee) => assignee.id);
    const validLabelIds = labels.map((label) => label.id);

    const card = await db.$transaction(async (tx) => {
      const lastCard = await tx.card.findFirst({
        where: {
          listId,
          archivedAt: null,
        },
        orderBy: {
          order: "desc",
        },
        select: {
          order: true,
        },
      });
      const newOrder = lastCard ? lastCard.order + 1 : 1;

      const createdCard = await tx.card.create({
        data: {
          title,
          description,
          listId,
          order: newOrder,
          ...(dueDateValue ? { dueDate: dueDateValue } : {}),
        },
      });

      if (validAssigneeIds.length > 0) {
        await tx.cardAssignee.createMany({
          data: validAssigneeIds.map((boardMemberId) => ({
            cardId: createdCard.id,
            boardMemberId,
          })),
          skipDuplicates: true,
        });
      }

      if (validLabelIds.length > 0) {
        await tx.cardLabel.createMany({
          data: validLabelIds.map((labelId) => ({
            cardId: createdCard.id,
            labelId,
          })),
          skipDuplicates: true,
        });
      }

      if (checklistItems.length > 0) {
        const checklist = await tx.checklist.create({
          data: {
            cardId: createdCard.id,
            title: "Việc cần làm",
            order: 0,
          },
        });

        await tx.checklistItem.createMany({
          data: checklistItems.map((item, index) => ({
            checklistId: checklist.id,
            title: item,
            order: index,
            isCompleted: false,
          })),
        });
      }

      return tx.card.findUniqueOrThrow({
        where: {
          id: createdCard.id,
        },
        include: {
          assignees: {
            include: {
              boardMember: true,
            },
            orderBy: {
              createdAt: "asc",
            },
          },
          labels: {
            include: {
              label: true,
            },
            orderBy: {
              createdAt: "asc",
            },
          },
          checklists: {
            select: {
              items: {
                select: {
                  isCompleted: true,
                },
              },
            },
          },
          _count: {
            select: {
              comments: true,
              attachments: true,
            },
          },
        },
      });
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
    });

    await createAuditLog({
      entityId: card.id,
      entityTitle: `detail:đã tạo thẻ "${card.title}" từ Smart Capture trong danh sách "${list.title}"`,
      entityType: ENTITY_TYPE.CARD,
      action: ACTION.CREATE,
      boardId,
      cardId: card.id,
    });

    await triggerCardCreated({
      boardId,
      listId,
      cardId: card.id,
      actorUserId: userId,
    });

    revalidatePath(`/board/${boardId}`);

    return {
      data: {
        ...card,
        checklistProgress: {
          total: checklistItems.length,
          completed: 0,
        },
        unresolvedBlockerCount: 0,
      },
    };
  } catch (error) {
    logger.error("[CREATE_SMART_CAPTURE_CARD_ERROR]", error, {
      action: "create-smart-capture-card",
      aiFeature: "smart-capture",
      orgId,
      userId,
      boardId,
      listId,
    });

    return { error: "Tạo thẻ từ Smart Capture thất bại." };
  }
};

export const createSmartCaptureCard = createSafeAction(CreateSmartCaptureCard, handler);
