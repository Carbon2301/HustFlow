"use server";

import { auth } from "@clerk/nextjs/server";
import { ACTION, AUDIT_EVENT_TYPE, ENTITY_TYPE } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { createAuditLog } from "@/lib/create-audit-log";
import { triggerChecklistItemMoved } from "@/lib/boards/realtime";
import { validateChecklistItemMove } from "@/lib/checklist-access";
import { createSafeAction } from "@/lib/create-safe-action";
import { db } from "@/lib/db";

import { MoveChecklistItem } from "./schema";
import { InputType, ReturnType } from "./types";

const hasContiguousOrders = (items: Array<{ order: number }>) =>
  items.every((item, index) => item.order === index);

const sortItemIds = (items: Array<{ id: string; order: number }>) =>
  [...items].sort((a, b) => a.order - b.order).map((item) => item.id);

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId, orgId } = await auth();

  if (!userId || !orgId) {
    return { error: "Khong co quyen truy cap." };
  }

  const {
    boardId,
    cardId,
    itemId,
    sourceChecklistId,
    destinationChecklistId,
    sourceItems,
    destinationItems,
  } = data;

  try {
    if (
      !hasContiguousOrders(sourceItems) ||
      !hasContiguousOrders(destinationItems)
    ) {
      return { error: "Thu tu muc cong viec khong hop le." };
    }

    const access = await validateChecklistItemMove({
      boardId,
      cardId,
      sourceChecklistId,
      destinationChecklistId,
      itemId,
      orgId,
      userId,
      sourceItems,
      destinationItems,
    });

    if (access.error || !access.sourceChecklist || !access.destinationChecklist) {
      return { error: access.error || "Khong the di chuyen muc cong viec." };
    }

    const updatedItems = await db.$transaction([
      ...sourceItems.map((item) =>
        db.checklistItem.update({
          where: {
            id: item.id,
          },
          data: {
            checklistId: sourceChecklistId,
            order: item.order,
          },
        }),
      ),
      ...destinationItems.map((item) =>
        db.checklistItem.update({
          where: {
            id: item.id,
          },
          data: {
            checklistId: destinationChecklistId,
            order: item.order,
          },
        }),
      ),
    ]);

    const verifiedCard = access.sourceChecklist.card;
    const verifiedBoardId = verifiedCard.list.boardId;

    await createAuditLog({
      entityId: itemId,
      entityTitle: "detail:đã di chuyển mục checklist",
      entityType: ENTITY_TYPE.CHECKLIST_ITEM,
      action: ACTION.UPDATE,
      eventType: AUDIT_EVENT_TYPE.CHECKLIST,
      boardId: verifiedBoardId,
      cardId: verifiedCard.id,
    });

    await triggerChecklistItemMoved({
      boardId: verifiedBoardId,
      cardId: verifiedCard.id,
      checklistItemId: itemId,
      sourceChecklistId: access.sourceChecklist.id,
      destinationChecklistId: access.destinationChecklist.id,
      actorUserId: userId,
      sourceOrderedItemIds: sortItemIds(sourceItems),
      destinationOrderedItemIds: sortItemIds(destinationItems),
    });

    revalidatePath(`/board/${verifiedBoardId}`);
    return { data: updatedItems };
  } catch (error) {
    console.error("[MOVE_CHECKLIST_ITEM_ERROR]", error);
    return { error: "Di chuyen muc cong viec that bai." };
  }
};

export const moveChecklistItem = createSafeAction(MoveChecklistItem, handler);
