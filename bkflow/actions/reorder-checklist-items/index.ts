"use server";

import { auth } from "@clerk/nextjs/server";
import { ACTION, AUDIT_EVENT_TYPE, ENTITY_TYPE } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { createAuditLog } from "@/lib/create-audit-log";
import { createSafeAction } from "@/lib/create-safe-action";
import { db } from "@/lib/db";
import { validateChecklistItemsForReorder } from "@/lib/checklist-access";
import { triggerChecklistItemReordered } from "@/lib/boards/realtime";

import { ReorderChecklistItems } from "./schema";
import { InputType, ReturnType } from "./types";

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId, orgId } = await auth();

  if (!userId || !orgId) {
    return { error: "Khong co quyen truy cap." };
  }

  const { boardId, cardId, checklistId, items } = data;

  try {
    const uniqueIds = new Set(items.map((item) => item.id));

    if (uniqueIds.size !== items.length) {
      return { error: "Danh sach sap xep khong hop le." };
    }

    const access = await validateChecklistItemsForReorder({
      boardId,
      cardId,
      checklistId,
      orgId,
      userId,
      items,
    });

    if (access.error || !access.checklist) {
      return { error: access.error || "Khong tim thay danh sach cong viec." };
    }

    const updatedItems = await db.$transaction(
      items.map((item) =>
        db.checklistItem.update({
          where: {
            id: item.id,
          },
          data: {
            order: item.order,
          },
        }),
      ),
    );
    const orderedItemIds = [...updatedItems]
      .sort((a, b) => a.order - b.order)
      .map((item) => item.id);
    const verifiedCard = access.checklist.card;
    const verifiedBoardId = verifiedCard.list.boardId;

    await createAuditLog({
      entityId: access.checklist.id,
      entityTitle: `detail:đã sắp xếp lại checklist "${access.checklist.title}"`,
      entityType: ENTITY_TYPE.CHECKLIST,
      action: ACTION.UPDATE,
      eventType: AUDIT_EVENT_TYPE.CHECKLIST,
      boardId: verifiedBoardId,
      cardId: verifiedCard.id,
    });

    await triggerChecklistItemReordered({
      boardId: verifiedBoardId,
      cardId: verifiedCard.id,
      checklistId: access.checklist.id,
      actorUserId: userId,
      orderedItemIds,
    });

    revalidatePath(`/board/${verifiedBoardId}`);
    return { data: updatedItems };
  } catch (error) {
    console.error("[REORDER_CHECKLIST_ITEMS_ERROR]", error);
    return { error: "Sap xep muc cong viec that bai." };
  }
};

export const reorderChecklistItems = createSafeAction(ReorderChecklistItems, handler);
