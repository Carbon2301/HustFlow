"use server";

import { auth } from "@clerk/nextjs/server";
import { ACTION, AUDIT_EVENT_TYPE, ENTITY_TYPE } from "@prisma/client";

import { createAuditLog } from "@/lib/create-audit-log";
import { db } from "@/lib/db";
import { createSafeAction } from "@/lib/create-safe-action";
import { requireBoardEditor } from "@/lib/permissions";
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
  let changedCards:
    | {
        id: string;
        order: number;
        listId: string;
      }[]
    = [];
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
    const permission = await requireBoardEditor({ boardId, orgId, userId });

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
        archivedAt: null,
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

    if (existingCards.length !== items.length) {
      return { error: "Không thể sắp xếp thẻ không thuộc bảng này." };
    }

    const nextCardsById = new Map(items.map((card) => [card.id, card]));
    changedCards = existingCards.flatMap((card) => {
      const nextCard = nextCardsById.get(card.id);

      if (!nextCard || (nextCard.order === card.order && nextCard.listId === card.listId)) {
        return [];
      }

      return [{
        id: nextCard.id,
        order: nextCard.order,
        listId: nextCard.listId,
      }];
    });

    if (changedCards.length === 0) {
      return { data: existingCards };
    }

    const movedExistingCard = existingCards.find((card) => {
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

    const transaction = changedCards.map((card) => 
      db.card.update({
        where: {
          id: card.id,
          archivedAt: null,
          list: {
            archivedAt: null,
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

  if (movedCard) {
    const lists = await db.list.findMany({
      where: {
        id: {
          in: [movedCard.sourceListId, movedCard.destinationListId],
        },
        archivedAt: null,
      },
      select: {
        id: true,
        title: true,
      },
    });

    const sourceList = lists.find((l) => l.id === movedCard!.sourceListId);
    const destList = lists.find((l) => l.id === movedCard!.destinationListId);

    const sourceTitle = sourceList ? sourceList.title : "Không xác định";
    const destTitle = destList ? destList.title : "Không xác định";

    await createAuditLog({
      entityId: movedCard.id,
      entityTitle: `detail:đã di chuyển thẻ "${movedCard.title}" từ danh sách "${sourceTitle}" tới danh sách "${destTitle}"`,
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
      sourceOrderedCardIds: items
        .filter((card) => card.listId === movedCard!.sourceListId)
        .sort((a, b) => a.order - b.order)
        .map((card) => card.id),
      destinationOrderedCardIds: items
        .filter((card) => card.listId === movedCard!.destinationListId)
        .sort((a, b) => a.order - b.order)
        .map((card) => card.id),
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
      orderedCardIds: reorderedListId
        ? items
            .filter((card) => card.listId === reorderedListId)
            .sort((a, b) => a.order - b.order)
            .map((card) => card.id)
        : undefined,
    });
  }

  return { data: updatedCards };
};

export const updateCardOrder = createSafeAction(UpdateCardOrder, handler);
