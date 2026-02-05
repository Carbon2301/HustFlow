"use server";

import { auth } from "@clerk/nextjs/server";
import { ACTION, AUDIT_EVENT_TYPE, ENTITY_TYPE } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { createAuditLog } from "@/lib/create-audit-log";
import { db } from "@/lib/db";
import { createSafeAction } from "@/lib/create-safe-action";
import { requireBoardMember } from "@/lib/permissions";
import {
  triggerCardMoved,
  triggerCardReordered,
} from "@/lib/boards/realtime";

import { UpdateCardOrder } from "./schema";
import { InputType, ReturnType } from "./types";

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId, orgId } = await auth();

  if (!userId || !orgId) {
    return {
      error: "Không có quyền truy cập.",
    };
  }

  const { items, boardId, } = data;
  let updatedCards;
  let movedCard:
    | {
        id: string;
        title: string;
        sourceListId: string;
        destinationListId: string;
      }
    | null = null;
  let reorderedListId: string | undefined;

  try {
    const permission = await requireBoardMember({ boardId, orgId, userId });

    if (permission.error) {
      return { error: permission.error };
    }

    const destinationListIds = Array.from(new Set(items.map((card) => card.listId)));
    const destinationListCount = await db.list.count({
      where: {
        id: {
          in: destinationListIds,
        },
        boardId,
        board: {
          orgId,
        },
      },
    });

    if (destinationListCount !== destinationListIds.length) {
      return { error: "Không thể di chuyển thẻ sang bảng khác." };
    }

    const existingCards = await db.card.findMany({
      where: {
        id: {
          in: items.map((card) => card.id),
        },
        list: {
          board: {
            id: boardId,
            orgId,
          },
        },
      },
    });

    if (existingCards.length !== items.length) {
      return { error: "KhÃ´ng thá»ƒ sáº¯p xáº¿p tháº» khÃ´ng thuá»™c báº£ng nÃ y." };
    }

    const nextCardsById = new Map(items.map((card) => [card.id, card]));
    const changedCards = existingCards.filter((card) => {
      const nextCard = nextCardsById.get(card.id);

      return Boolean(
        nextCard &&
          (nextCard.order !== card.order || nextCard.listId !== card.listId),
      );
    });

    if (changedCards.length === 0) {
      return { data: existingCards };
    }

    const movedExistingCard = changedCards.find((card) => {
      const nextCard = nextCardsById.get(card.id);

      return Boolean(nextCard && nextCard.listId !== card.listId);
    });

    if (movedExistingCard) {
      const nextCard = nextCardsById.get(movedExistingCard.id);

      movedCard = nextCard
        ? {
            id: movedExistingCard.id,
            title: movedExistingCard.title,
            sourceListId: movedExistingCard.listId,
            destinationListId: nextCard.listId,
          }
        : null;
    } else {
      const listIds = Array.from(new Set(items.map((card) => card.listId)));
      reorderedListId = listIds.length === 1 ? listIds[0] : undefined;
    }

    const transaction = items.map((card) => 
      db.card.update({
        where: {
          id: card.id,
          list: {
            board: {
              id: boardId,
              orgId,
            },
          },
        },
        data: {
          order: card.order,
          listId: card.listId,
        },
      }),
    );

    updatedCards = await db.$transaction(transaction);
  } catch {
    return {
      error: "Thay đổi thứ tự thẻ thất bại."
    }
  }

  revalidatePath(`/board/${boardId}`);
  if (movedCard) {
    await createAuditLog({
      entityId: movedCard.id,
      entityTitle: `detail:đã di chuyển thẻ "${movedCard.title}"`,
      entityType: ENTITY_TYPE.CARD,
      action: ACTION.UPDATE,
      eventType: AUDIT_EVENT_TYPE.MOVE,
      boardId,
      cardId: movedCard.id,
    });

    await triggerCardMoved({
      boardId,
      actorUserId: userId,
      cardId: movedCard.id,
      sourceListId: movedCard.sourceListId,
      destinationListId: movedCard.destinationListId,
    });
  } else {
    await createAuditLog({
      entityId: boardId,
      entityTitle: "detail:đã sắp xếp lại thứ tự thẻ",
      entityType: ENTITY_TYPE.BOARD,
      action: ACTION.UPDATE,
      eventType: AUDIT_EVENT_TYPE.MOVE,
      boardId,
    });

    await triggerCardReordered({
      boardId,
      actorUserId: userId,
      listId: reorderedListId,
    });
  }

  return { data: updatedCards };
};

export const updateCardOrder = createSafeAction(UpdateCardOrder, handler);
