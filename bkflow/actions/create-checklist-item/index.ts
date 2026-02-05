"use server";

import { auth } from "@clerk/nextjs/server";
import { ACTION, AUDIT_EVENT_TYPE, ENTITY_TYPE } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { createAuditLog } from "@/lib/create-audit-log";
import { db } from "@/lib/db";
import { createSafeAction } from "@/lib/create-safe-action";
import { requireBoardMember } from "@/lib/permissions";
import { triggerChecklistItemCreated } from "@/lib/boards/realtime";

import { CreateChecklistItem } from "./schema";
import { InputType, ReturnType } from "./types";

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId, orgId } = await auth();

  if (!userId || !orgId) {
    return {
      error: "Không có quyền truy cập.",
    };
  }

  const { boardId, cardId, checklistId, title } = data;

  try {
    const permission = await requireBoardMember({ boardId, orgId, userId });

    if (permission.error) {
      return { error: permission.error };
    }

    const card = await db.card.findUnique({
      where: {
        id: cardId,
        list: {
          board: {
            id: boardId,
            orgId,
          },
        },
      },
    });

    if (!card) {
      return { error: "Không tìm thấy thẻ." };
    }

    const checklist = await db.checklist.findUnique({
      where: {
        id: checklistId,
        cardId,
      },
    });

    if (!checklist) {
      return { error: "Không tìm thấy danh sách việc cần làm." };
    }

    const lastItem = await db.checklistItem.findFirst({
      where: {
        checklistId,
      },
      orderBy: {
        order: "desc",
      },
      select: {
        order: true,
      },
    });

    const newOrder = lastItem ? lastItem.order + 1 : 0;

    const checklistItem = await db.checklistItem.create({
      data: {
        checklistId,
        title,
        order: newOrder,
        isCompleted: false,
      },
    });

    await createAuditLog({
      entityId: checklistItem.id,
      entityTitle: `detail:đã thêm "${checklistItem.title}" vào checklist "${checklist.title}"`,
      entityType: ENTITY_TYPE.CHECKLIST_ITEM,
      action: ACTION.UPDATE,
      eventType: AUDIT_EVENT_TYPE.CHECKLIST,
      boardId,
      cardId: card.id,
    });

    await triggerChecklistItemCreated({
      boardId,
      cardId: card.id,
      checklistId: checklist.id,
      checklistItemId: checklistItem.id,
      actorUserId: userId,
    });

    revalidatePath(`/board/${boardId}`);
    return { data: checklistItem };
  } catch (error) {
    console.error("[CREATE_CHECKLIST_ITEM_ERROR]", error);
    return {
      error: "Tạo mục công việc thất bại.",
    };
  }
};

export const createChecklistItem = createSafeAction(CreateChecklistItem, handler);
