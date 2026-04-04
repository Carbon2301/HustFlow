"use server";

import { auth } from "@clerk/nextjs/server";
import { ACTION, ENTITY_TYPE } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { createAuditLog } from "@/lib/create-audit-log";
import { createSafeAction } from "@/lib/create-safe-action";
import { db } from "@/lib/db";
import { requireBoardEditor } from "@/lib/permissions";
import { triggerCardDeleted } from "@/lib/boards/realtime";
import { triggerRelatedDependencyCardsUpdated } from "@/lib/cards/realtime";

import { DeleteArchivedCard } from "./schema";
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
  let affectedBlockedCardIds: string[] = [];

  try {
    const permission = await requireBoardEditor({ boardId, orgId, userId });

    if (permission.error) {
      return { error: permission.error };
    }

    card = await db.$transaction(async (tx) => {
      const existingCard = await tx.card.findFirst({
        where: {
          id,
          archivedAt: {
            not: null,
          },
          list: {
            board: {
              id: boardId,
              orgId,
            },
          },
        },
        include: {
          list: {
            select: {
              title: true,
            },
          },
        },
      });

      if (!existingCard) {
        throw new Error("CARD_NOT_FOUND");
      }

      const affectedDependencies = await tx.cardDependency.findMany({
        where: {
          blockerCardId: existingCard.id,
          blockerCard: {
            list: {
              board: {
                id: boardId,
                orgId,
              },
            },
          },
        },
        select: {
          blockedCardId: true,
        },
      });
      affectedBlockedCardIds = affectedDependencies.map((dependency) => dependency.blockedCardId);

      return tx.card.delete({
        where: {
          id: existingCard.id,
        },
        include: {
          list: {
            select: {
              title: true,
            },
          },
        },
      });
    });

    await createAuditLog({
      entityTitle: `detail:đã xóa vĩnh viễn thẻ "${card.title}"`,
      entityId: card.id,
      entityType: ENTITY_TYPE.CARD,
      action: ACTION.DELETE,
      boardId,
      cardId: card.id,
    });

    await triggerCardDeleted({
      boardId,
      listId: card.listId,
      cardId: card.id,
      actorUserId: userId,
    });

    await triggerRelatedDependencyCardsUpdated({
      boardId,
      sourceCardId: card.id,
      relatedCardIds: affectedBlockedCardIds,
      actorUserId: userId,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "CARD_NOT_FOUND") {
      return {
        error: "Không tìm thấy thẻ đã lưu trữ.",
      };
    }

    return {
      error: "Xóa vĩnh viễn thẻ thất bại.",
    };
  }

  revalidatePath(`/board/${boardId}`);
  return { data: card };
};

export const deleteArchivedCard = createSafeAction(DeleteArchivedCard, handler);
