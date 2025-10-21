"use server";

import { auth } from "@clerk/nextjs/server";
import { ACTION, ENTITY_TYPE } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { createAuditLog } from "@/lib/create-audit-log";
import { createSafeAction } from "@/lib/create-safe-action";
import { db } from "@/lib/db";
import { getChecklistItemAccess } from "@/lib/checklist-access";
import { triggerChecklistItemToggled } from "@/lib/boards/realtime";

import { ToggleChecklistItem } from "./schema";
import { InputType, ReturnType } from "./types";

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId, orgId } = await auth();

  if (!userId || !orgId) {
    return { error: "Không có quyền truy cập." };
  }

  const { boardId, cardId, id, isCompleted } = data;

  try {
    const access = await getChecklistItemAccess({
      boardId,
      cardId,
      itemId: id,
      orgId,
      userId,
    });

    if (access.error || !access.item) {
      return { error: access.error || "Không tìm thấy mục công việc." };
    }

    if (access.item.isCompleted === isCompleted) {
      return { data: access.item };
    }

    const item = await db.checklistItem.update({
      where: {
        id,
      },
      data: {
        isCompleted,
      },
    });

    await createAuditLog({
      entityId: item.id,
      entityTitle: isCompleted
        ? `detail:đã hoàn thành "${access.item.title}"`
        : `detail:đã bỏ hoàn thành "${access.item.title}"`,
      entityType: ENTITY_TYPE.CHECKLIST_ITEM,
      action: ACTION.UPDATE,
      cardId,
    });

    await triggerChecklistItemToggled({
      boardId: access.item.checklist.card.list.boardId,
      cardId: access.item.checklist.cardId,
      checklistId: access.item.checklistId,
      checklistItemId: item.id,
      actorUserId: userId,
      includeLogs: true,
    });

    revalidatePath(`/board/${boardId}`);
    return { data: item };
  } catch (error) {
    console.error("[TOGGLE_CHECKLIST_ITEM_ERROR]", error);
    return { error: "Cập nhật trạng thái mục công việc thất bại." };
  }
};

export const toggleChecklistItem = createSafeAction(ToggleChecklistItem, handler);
