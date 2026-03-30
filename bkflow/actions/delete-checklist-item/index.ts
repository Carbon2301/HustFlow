"use server";

import { auth } from "@clerk/nextjs/server";
import { ACTION, AUDIT_EVENT_TYPE, ENTITY_TYPE, NOTIFICATION_TYPE } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { createAuditLog } from "@/lib/create-audit-log";
import { db } from "@/lib/db";
import { createSafeAction } from "@/lib/create-safe-action";
import { requireBoardEditor } from "@/lib/permissions";
import { triggerChecklistItemDeleted } from "@/lib/boards/realtime";

import { DeleteChecklistItem } from "./schema";
import { InputType, ReturnType } from "./types";

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId, orgId } = await auth();

  if (!userId || !orgId) {
    return {
      error: "Không có quyền truy cập.",
    };
  }

  const { boardId, cardId, id } = data;

  try {
    const permission = await requireBoardEditor({ boardId, orgId, userId });

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

    const checklistItem = await db.checklistItem.findUnique({
      where: {
        id,
        checklist: {
          cardId,
        },
      },
      include: {
        checklist: {
          select: {
            id: true,
            cardId: true,
            title: true,
          },
        },
      },
    });

    if (!checklistItem) {
      return { error: "Không tìm thấy mục công việc." };
    }

    await db.notification.deleteMany({
      where: {
        type: NOTIFICATION_TYPE.CHECKLIST_ITEM_ASSIGNED,
        dedupeKey: `checklist-item-assigned:${checklistItem.id}`,
        readAt: null,
      },
    });

    await db.checklistItem.delete({
      where: {
        id,
      },
    });

    await createAuditLog({
      entityId: checklistItem.id,
      entityTitle: `detail:đã xóa mục công việc "${checklistItem.title}" khỏi danh sách công việc "${checklistItem.checklist.title}"`,
      entityType: ENTITY_TYPE.CHECKLIST_ITEM,
      action: ACTION.UPDATE,
      eventType: AUDIT_EVENT_TYPE.CHECKLIST,
      boardId,
      cardId: checklistItem.checklist.cardId,
    });

    await triggerChecklistItemDeleted({
      boardId,
      cardId: checklistItem.checklist.cardId,
      checklistId: checklistItem.checklist.id,
      checklistItemId: checklistItem.id,
      actorUserId: userId,
    });

    revalidatePath(`/board/${boardId}`);
    return { data: checklistItem };
  } catch (error) {
    console.error("[DELETE_CHECKLIST_ITEM_ERROR]", error);
    return {
      error: "Xóa mục công việc thất bại.",
    };
  }
};

export const deleteChecklistItem = createSafeAction(DeleteChecklistItem, handler);
