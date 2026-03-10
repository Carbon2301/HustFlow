"use server";

import { auth } from "@clerk/nextjs/server";
import { ACTION, ENTITY_TYPE } from "@prisma/client";

import { db } from "@/lib/db";
import { createAuditLog } from "@/lib/create-audit-log";
import { createSafeAction } from "@/lib/create-safe-action";
import { requireBoardMember } from "@/lib/permissions";
import { triggerCardCreated } from "@/lib/boards/realtime";

import { CopyCard } from "./schema";
import { InputType, ReturnType } from "./types";

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId, orgId } = await auth();

  if (!userId || !orgId) {
    return {
      error: "Không có quyền truy cập.",
    };
  }

  const { id, boardId } = data;
  let card;

  try {
    const permission = await requireBoardMember({ boardId, orgId, userId });

    if (permission.error) {
      return { error: permission.error };
    }

    const cardToCopy = await db.card.findFirst({
      where: {
        id,
        archivedAt: null,
        list: {
          archivedAt: null,
          board: {
            id: boardId,
            orgId,
          },
        },
      },
    });

    if (!cardToCopy) {
      return { error: "Không tìm thấy thẻ." }
    }

    const lastCard = await db.card.findFirst({
      where: {
        listId: cardToCopy.listId,
        archivedAt: null,
      },
      orderBy: { order: "desc" },
      select: { order: true }
    });

    const newOrder = lastCard ? lastCard.order + 1 : 1;

    card = await db.card.create({
      data: {
        title: `${cardToCopy.title} - Bản sao`,
        description: cardToCopy.description,
        dueDate: cardToCopy.dueDate,
        isCompleted: cardToCopy.isCompleted,
        order: newOrder,
        listId: cardToCopy.listId,
      },
    });

    await createAuditLog({
      entityTitle: card.title,
      entityId: card.id,
      entityType: ENTITY_TYPE.CARD,
      action: ACTION.CREATE,
      boardId,
      cardId: card.id,
    })

    await triggerCardCreated({
      boardId,
      listId: card.listId,
      cardId: card.id,
      actorUserId: userId,
    });
  } catch {
    return {
      error: "Sao chép thẻ thất bại."
    }
  }

  return { data: card };
};

export const copyCard = createSafeAction(CopyCard, handler);
