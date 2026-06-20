"use server";

import { auth } from "@clerk/nextjs/server";
import { ACTION, AUDIT_EVENT_TYPE, ENTITY_TYPE } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { createAuditLog } from "@/lib/create-audit-log";
import { createSafeAction } from "@/lib/create-safe-action";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { requireBoardEditor } from "@/lib/permissions";
import {
  triggerChecklistCreated,
  triggerChecklistItemCreated,
} from "@/lib/boards/realtime";

import { CreateAiChecklistItems } from "./schema";
import { InputType, ReturnType } from "./types";

const DEFAULT_AI_CHECKLIST_TITLE = "Việc cần làm";

const normalizeForDedupe = (value: string) => value.trim().toLowerCase();

const normalizeItems = (items: string[]) => {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of items) {
    const title = item.replace(/\s+/g, " ").trim();
    const key = normalizeForDedupe(title);

    if (!title || seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(title);
  }

  return result.slice(0, 8);
};

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId, orgId } = await auth();

  if (!userId || !orgId) {
    return { error: "Không có quyền truy cập." };
  }

  const { boardId, cardId, checklistId, checklistTitle } = data;
  const items = normalizeItems(data.items);

  if (items.length === 0) {
    return { error: "Vui lòng chọn ít nhất một mục checklist." };
  }

  try {
    const permission = await requireBoardEditor({ boardId, orgId, userId });

    if (permission.error) {
      return { error: permission.error };
    }

    const card = await db.card.findFirst({
      where: {
        id: cardId,
        archivedAt: null,
        list: {
          archivedAt: null,
          board: {
            id: boardId,
            orgId,
          },
        },
      },
      select: {
        id: true,
        title: true,
      },
    });

    if (!card) {
      return { error: "Không tìm thấy thẻ." };
    }

    const result = await db.$transaction(async (tx) => {
      let checklist = checklistId
        ? await tx.checklist.findFirst({
            where: {
              id: checklistId,
              cardId,
              card: {
                archivedAt: null,
                list: {
                  archivedAt: null,
                  board: {
                    id: boardId,
                    orgId,
                  },
                },
              },
            },
          })
        : null;
      let checklistCreated = false;

      if (checklistId && !checklist) {
        throw new Error("Không tìm thấy danh sách việc cần làm.");
      }

      if (!checklist) {
        const lastChecklist = await tx.checklist.findFirst({
          where: {
            cardId,
          },
          orderBy: {
            order: "desc",
          },
          select: {
            order: true,
          },
        });

        checklist = await tx.checklist.create({
          data: {
            cardId,
            title: checklistTitle?.trim() || DEFAULT_AI_CHECKLIST_TITLE,
            order: lastChecklist ? lastChecklist.order + 1 : 0,
          },
        });
        checklistCreated = true;
      }

      const existingItems = await tx.checklistItem.findMany({
        where: {
          checklistId: checklist.id,
        },
        select: {
          title: true,
          order: true,
        },
        orderBy: {
          order: "desc",
        },
      });
      const existingTitles = new Set(existingItems.map((item) => normalizeForDedupe(item.title)));
      const filteredItems = items.filter((item) => !existingTitles.has(normalizeForDedupe(item)));

      if (filteredItems.length === 0) {
        throw new Error("Các mục AI gợi ý đã tồn tại trong checklist.");
      }

      const startOrder = existingItems[0] ? existingItems[0].order + 1 : 0;
      const createdItems = [];

      for (const [index, title] of filteredItems.entries()) {
        const createdItem = await tx.checklistItem.create({
          data: {
            checklistId: checklist.id,
            title,
            order: startOrder + index,
            isCompleted: false,
          },
        });

        createdItems.push(createdItem);
      }

      return {
        checklist,
        checklistCreated,
        createdItems,
      };
    });

    await createAuditLog({
      entityId: result.checklist.id,
      entityTitle: `detail:đã thêm ${result.createdItems.length} mục AI vào danh sách công việc "${result.checklist.title}" của thẻ "${card.title}"`,
      entityType: ENTITY_TYPE.CHECKLIST,
      action: ACTION.UPDATE,
      eventType: AUDIT_EVENT_TYPE.CHECKLIST,
      boardId,
      cardId: card.id,
    });

    if (result.checklistCreated) {
      await triggerChecklistCreated({
        boardId,
        cardId: card.id,
        checklistId: result.checklist.id,
        actorUserId: userId,
        includeLogs: false,
      });
    }

    await Promise.all(
      result.createdItems.map((item, index) =>
        triggerChecklistItemCreated({
          boardId,
          cardId: card.id,
          checklistId: result.checklist.id,
          checklistItemId: item.id,
          actorUserId: userId,
          includeLogs: index === result.createdItems.length - 1,
        }),
      ),
    );

    revalidatePath(`/board/${boardId}`);

    return {
      data: {
        checklist: result.checklist,
        items: result.createdItems,
      },
    };
  } catch (error) {
    logger.error("[CREATE_AI_CHECKLIST_ITEMS_ERROR]", error, {
      action: "create-ai-checklist-items",
      aiFeature: "checklist-generation",
      orgId,
      userId,
      boardId,
      cardId,
      checklistId,
    });

    return {
      error: error instanceof Error
        ? error.message
        : "Thêm checklist bằng AI thất bại.",
    };
  }
};

export const createAiChecklistItems = createSafeAction(CreateAiChecklistItems, handler);
