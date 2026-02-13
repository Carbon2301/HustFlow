"use server";

import { auth } from "@clerk/nextjs/server";
import { ACTION, ENTITY_TYPE } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { createAuditLog } from "@/lib/create-audit-log";
import { createSafeAction } from "@/lib/create-safe-action";
import { db } from "@/lib/db";
import { requireBoardMember } from "@/lib/permissions";
import { triggerCardCreated } from "@/lib/boards/realtime";

import { RestoreCard } from "./schema";
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
              archivedAt: true,
              title: true,
            },
          },
        },
      });

      if (!existingCard) {
        throw new Error("CARD_NOT_FOUND");
      }

      if (existingCard.list.archivedAt) {
        throw new Error("LIST_ARCHIVED");
      }

      return tx.card.update({
        where: {
          id: existingCard.id,
        },
        data: {
          archivedAt: null,
          archivedByListId: null,
        },
        include: {
          list: {
            select: {
              archivedAt: true,
              title: true,
            },
          },
        },
      });
    });

    await createAuditLog({
      entityTitle: `detail:đã khôi phục thẻ "${card.title}" vào danh sách "${card.list.title}"`,
      entityId: card.id,
      entityType: ENTITY_TYPE.CARD,
      action: ACTION.UPDATE,
      boardId,
      cardId: card.id,
    });

    await triggerCardCreated({
      boardId,
      listId: card.listId,
      cardId: card.id,
      actorUserId: userId,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "CARD_NOT_FOUND") {
      return {
        error: "Không tìm thấy thẻ đã lưu trữ.",
      };
    }

    if (error instanceof Error && error.message === "LIST_ARCHIVED") {
      return {
        error: "Cần khôi phục danh sách trước khi khôi phục thẻ này.",
      };
    }

    return {
      error: "Khôi phục thẻ thất bại.",
    };
  }

  revalidatePath(`/board/${boardId}`);
  return { data: card };
};

export const restoreCard = createSafeAction(RestoreCard, handler);
