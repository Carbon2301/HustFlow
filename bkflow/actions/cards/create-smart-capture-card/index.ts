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

import { CreateSmartCaptureCards } from "./schema";
import { InputType, ReturnType } from "./types";

type DraftInput = InputType["drafts"][number];

const normalizeDueDate = (value: DraftInput["dueDate"]) => {
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

  const { boardId, drafts } = data;

  try {
    const permission = await requireBoardEditor({ boardId, orgId, userId });

    if (permission.error) {
      return { error: permission.error };
    }

    const requestedListIds = Array.from(new Set(drafts.map((draft) => draft.listId)));
    const requestedAssigneeIds = Array.from(
      new Set(drafts.flatMap((draft) => [
        ...draft.assigneeBoardMemberIds,
        ...(draft.assigneeBoardMemberId ? [draft.assigneeBoardMemberId] : []),
      ])),
    );
    const requestedLabelIds = Array.from(
      new Set(drafts.flatMap((draft) => draft.labelIds)),
    );

    const [lists, assignees, labels] = await Promise.all([
      db.list.findMany({
        where: {
          id: {
            in: requestedListIds,
          },
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
      }),
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
      requestedLabelIds.length > 0
        ? db.label.findMany({
            where: {
              id: {
                in: requestedLabelIds,
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

    const listById = new Map(lists.map((list) => [list.id, list]));

    if (requestedListIds.some((listId) => !listById.has(listId))) {
      return { error: "Không tìm thấy một hoặc nhiều danh sách." };
    }

    const validAssigneeIds = new Set(
      assignees
        .filter(isAssignableBoardMember)
        .map((assignee) => assignee.id),
    );
    const validLabelIds = new Set(labels.map((label) => label.id));
    const normalizedDrafts = drafts.map((draft) => ({
      ...draft,
      dueDateValue: normalizeDueDate(draft.dueDate),
      checklistItems: normalizeChecklistItems(draft.checklistItems),
      assigneeBoardMemberIds: Array.from(new Set([
        ...draft.assigneeBoardMemberIds,
        ...(draft.assigneeBoardMemberId ? [draft.assigneeBoardMemberId] : []),
      ])).filter((id) => validAssigneeIds.has(id)),
      labelIds: Array.from(new Set(draft.labelIds)).filter((id) => validLabelIds.has(id)),
    }));

    const cards = await db.$transaction(async (tx) => {
      const orderCursorByListId = new Map<string, number>();
      const createdCards = [];

      for (const listId of requestedListIds) {
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

        orderCursorByListId.set(listId, lastCard ? lastCard.order : 0);
      }

      for (const draft of normalizedDrafts) {
        const nextOrder = (orderCursorByListId.get(draft.listId) ?? 0) + 1;

        orderCursorByListId.set(draft.listId, nextOrder);

        const createdCard = await tx.card.create({
          data: {
            title: draft.title,
            description: draft.description,
            listId: draft.listId,
            order: nextOrder,
            ...(draft.dueDateValue ? { dueDate: draft.dueDateValue } : {}),
          },
        });

        if (draft.assigneeBoardMemberIds.length > 0) {
          await tx.cardAssignee.createMany({
            data: draft.assigneeBoardMemberIds.map((boardMemberId) => ({
              cardId: createdCard.id,
              boardMemberId,
            })),
            skipDuplicates: true,
          });
        }

        if (draft.labelIds.length > 0) {
          await tx.cardLabel.createMany({
            data: draft.labelIds.map((labelId) => ({
              cardId: createdCard.id,
              labelId,
            })),
            skipDuplicates: true,
          });
        }

        if (draft.checklistItems.length > 0) {
          const checklist = await tx.checklist.create({
            data: {
              cardId: createdCard.id,
              title: "Việc cần làm",
              order: 0,
            },
          });

          await tx.checklistItem.createMany({
            data: draft.checklistItems.map((item, index) => ({
              checklistId: checklist.id,
              title: item,
              order: index,
              isCompleted: false,
            })),
          });
        }

        const card = await tx.card.findUniqueOrThrow({
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

        createdCards.push({
          ...card,
          checklistProgress: {
            total: draft.checklistItems.length,
            completed: 0,
          },
          unresolvedBlockerCount: 0,
        });
      }

      return createdCards;
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
    });

    await Promise.all(cards.map((card) => {
      const list = listById.get(card.listId);

      return createAuditLog({
        entityId: card.id,
        entityTitle: `detail:đã tạo thẻ "${card.title}" từ Smart Capture trong danh sách "${list?.title ?? ""}"`,
        entityType: ENTITY_TYPE.CARD,
        action: ACTION.CREATE,
        boardId,
        cardId: card.id,
      });
    }));

    await Promise.all(cards.map((card) =>
      triggerCardCreated({
        boardId,
        listId: card.listId,
        cardId: card.id,
        actorUserId: userId,
      }),
    ));

    revalidatePath(`/board/${boardId}`);

    return { data: cards };
  } catch (error) {
    logger.error("[CREATE_SMART_CAPTURE_CARDS_ERROR]", error, {
      action: "create-smart-capture-cards",
      aiFeature: "smart-capture",
      orgId,
      userId,
      boardId,
      draftCount: drafts.length,
    });

    return { error: "Tạo thẻ từ Smart Capture thất bại." };
  }
};

export const createSmartCaptureCards = createSafeAction(CreateSmartCaptureCards, handler);
