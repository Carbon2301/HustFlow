"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { ACTION, AUDIT_EVENT_TYPE, ENTITY_TYPE, NOTIFICATION_TYPE } from "@prisma/client";

import { db } from "@/lib/db";
import { createSafeAction } from "@/lib/create-safe-action";
import { requireBoardEditor } from "@/lib/permissions";
import { createAuditLog } from "@/lib/create-audit-log";
import { triggerChecklistDeleted } from "@/lib/boards/realtime";

import { DeleteChecklist } from "./schema";
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

    const checklist = await db.checklist.findUnique({
      where: {
        id,
        cardId,
      },
    });

    if (!checklist) {
      return { error: "Không tìm thấy danh sách việc cần làm." };
    }

    const checklistItems = await db.checklistItem.findMany({
      where: {
        checklistId: checklist.id,
      },
      select: {
        id: true,
      },
    });

    if (checklistItems.length > 0) {
      await db.notification.deleteMany({
        where: {
          type: NOTIFICATION_TYPE.CHECKLIST_ITEM_ASSIGNED,
          dedupeKey: {
            in: checklistItems.map((item) => `checklist-item-assigned:${item.id}`),
          },
          readAt: null,
        },
      });
    }

    await db.checklist.delete({
      where: {
        id,
      },
    });

    await createAuditLog({
      entityId: checklist.id,
      entityTitle: `detail:đã xóa danh sách công việc "${checklist.title}" khỏi thẻ "${card.title}"`,
      entityType: ENTITY_TYPE.CHECKLIST,
      action: ACTION.UPDATE,
      eventType: AUDIT_EVENT_TYPE.CHECKLIST,
      boardId,
      cardId: card.id,
    });

    await triggerChecklistDeleted({
      boardId,
      cardId: card.id,
      checklistId: checklist.id,
      actorUserId: userId,
      includeLogs: true,
    });

    revalidatePath(`/board/${boardId}`);
    return { data: checklist };
  } catch (error) {
    console.error("[DELETE_CHECKLIST_ERROR]", error);
    return {
      error: "Xóa danh sách việc cần làm thất bại.",
    };
  }
};

export const deleteChecklist = createSafeAction(DeleteChecklist, handler);
