"use server";

import { auth } from "@clerk/nextjs/server";
import { ACTION, AUDIT_EVENT_TYPE, ENTITY_TYPE } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { createAuditLog } from "@/lib/create-audit-log";
import { createSafeAction } from "@/lib/create-safe-action";
import { db } from "@/lib/db";
import { getChecklistItemAccess } from "@/lib/checklist-access";
import { triggerChecklistItemUpdated } from "@/lib/boards/realtime";

import { RenameChecklistItem } from "./schema";
import { InputType, ReturnType } from "./types";

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId, orgId } = await auth();

  if (!userId || !orgId) {
    return { error: "Không có quyền truy cập." };
  }

  const { boardId, cardId, id, title } = data;

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

    if (access.item.title === title) {
      return { data: access.item };
    }

    const item = await db.checklistItem.update({
      where: {
        id,
      },
      data: {
        title,
      },
    });

    await createAuditLog({
      entityId: item.id,
      entityTitle: `detail:đã đổi tên mục công việc thành "${title}"`,
      entityType: ENTITY_TYPE.CHECKLIST_ITEM,
      action: ACTION.UPDATE,
      eventType: AUDIT_EVENT_TYPE.CHECKLIST,
      boardId,
      cardId,
    });

    await triggerChecklistItemUpdated({
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
    console.error("[RENAME_CHECKLIST_ITEM_ERROR]", error);
    return { error: "Đổi tên mục công việc thất bại." };
  }
};

export const renameChecklistItem = createSafeAction(RenameChecklistItem, handler);
