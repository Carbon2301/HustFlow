"use server";

import { auth } from "@clerk/nextjs/server";
import { ACTION, ENTITY_TYPE } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { createAuditLog } from "@/lib/create-audit-log";
import { createSafeAction } from "@/lib/create-safe-action";
import { db } from "@/lib/db";
import { requireBoardMember } from "@/lib/permissions";
import { triggerCardDeleted } from "@/lib/boards/realtime";

import { ArchiveCard } from "./schema";
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
          archivedAt: null,
          list: {
            archivedAt: null,
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

      return tx.card.update({
        where: {
          id: existingCard.id,
        },
        data: {
          archivedAt: new Date(),
          archivedByListId: null,
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
      entityTitle: `detail:đã lưu trữ thẻ "${card.title}" từ danh sách "${card.list.title}"`,
      entityId: card.id,
      entityType: ENTITY_TYPE.CARD,
      action: ACTION.UPDATE,
      boardId,
      cardId: card.id,
    });

    await triggerCardDeleted({
      boardId,
      listId: card.listId,
      cardId: card.id,
      actorUserId: userId,
      archived: true,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "CARD_NOT_FOUND") {
      return {
        error: "Không tìm thấy thẻ hoặc thẻ đã được lưu trữ.",
      };
    }

    return {
      error: "Lưu trữ thẻ thất bại.",
    };
  }

  revalidatePath(`/board/${boardId}`);
  return { data: card };
};

export const archiveCard = createSafeAction(ArchiveCard, handler);
