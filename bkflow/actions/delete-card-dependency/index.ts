"use server";

import { auth } from "@clerk/nextjs/server";
import { ACTION, AUDIT_EVENT_TYPE, ENTITY_TYPE } from "@prisma/client";

import { createAuditLog } from "@/lib/create-audit-log";
import { createSafeAction } from "@/lib/create-safe-action";
import { db } from "@/lib/db";
import { triggerRelatedDependencyCardsUpdated } from "@/lib/cards/realtime";
import { requireBoardEditor } from "@/lib/permissions";

import { DeleteCardDependency } from "./schema";
import { InputType, ReturnType } from "./types";

const formatAuditCardMarker = (card: { id: string; title: string }) =>
  `[card:${card.id}|${card.title.replace(/[\[\]|]/g, " ")}]`;

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId, orgId } = await auth();

  if (!userId || !orgId) {
    return {
      error: "Không có quyền truy cập.",
    };
  }

  const { boardId, dependencyId } = data;

  try {
    const permission = await requireBoardEditor({ boardId, orgId, userId });

    if (permission.error) {
      return { error: permission.error };
    }

    const dependency = await db.cardDependency.findFirst({
      where: {
        id: dependencyId,
        blockerCard: {
          list: {
            board: {
              id: boardId,
              orgId,
            },
          },
        },
        blockedCard: {
          list: {
            board: {
              id: boardId,
              orgId,
            },
          },
        },
      },
      include: {
        blockerCard: {
          select: {
            id: true,
            title: true,
          },
        },
        blockedCard: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    if (!dependency) {
      return {
        error: "Không tìm thấy liên kết phụ thuộc.",
      };
    }

    const deletedDependency = await db.cardDependency.delete({
      where: {
        id: dependency.id,
      },
    });

    await createAuditLog({
      entityId: deletedDependency.id,
      entityType: ENTITY_TYPE.CARD,
      entityTitle: `detail:đã xóa liên kết phụ thuộc: thẻ ${formatAuditCardMarker(dependency.blockedCard)} không còn phụ thuộc vào thẻ ${formatAuditCardMarker(dependency.blockerCard)}`,
      action: ACTION.UPDATE,
      eventType: AUDIT_EVENT_TYPE.UPDATE,
      boardId,
      cardId: dependency.blockedCard.id,
    });

    await triggerRelatedDependencyCardsUpdated({
      boardId,
      sourceCardId: dependency.blockerCard.id,
      relatedCardIds: [dependency.blockedCard.id],
      actorUserId: userId,
    });

    return { data: deletedDependency };
  } catch (error) {
    console.error("[DELETE_CARD_DEPENDENCY_ERROR]", error);
    return {
      error: "Xóa liên kết phụ thuộc thất bại.",
    };
  }
};

export const deleteCardDependency = createSafeAction(DeleteCardDependency, handler);
