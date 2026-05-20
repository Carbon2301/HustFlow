"use server";

import { auth } from "@clerk/nextjs/server";
import { ACTION, ENTITY_TYPE } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { createAuditLog } from "@/lib/create-audit-log";
import { createSafeAction } from "@/lib/create-safe-action";
import { db } from "@/lib/db";
import { requireBoardEditor } from "@/lib/permissions";
import { triggerCardReordered } from "@/lib/boards/realtime";
import {
  getRelatedDependencyCardIds,
  triggerRelatedDependencyCardsUpdated,
} from "@/lib/cards/realtime";

import { ArchiveListCards } from "./schema";
import { InputType, ReturnType } from "./types";

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId, orgId } = await auth();

  if (!userId || !orgId) {
    return {
      error: "Không có quyền truy cập.",
    };
  }

  const { id, boardId } = data;
  let list;
  let affectedCardIds: string[] = [];
  let relatedDependencyCardIds: string[] = [];

  try {
    const permission = await requireBoardEditor({ boardId, orgId, userId });

    if (permission.error) {
      return { error: permission.error };
    }

    const archivedAt = new Date();

    list = await db.$transaction(async (tx) => {
      const existingList = await tx.list.findFirst({
        where: {
          id,
          boardId,
          archivedAt: null,
          board: {
            orgId,
          },
        },
      });

      if (!existingList) {
        throw new Error("LIST_NOT_FOUND");
      }

      const cardsToArchive = await tx.card.findMany({
        where: {
          listId: existingList.id,
          archivedAt: null,
        },
        select: {
          id: true,
        },
      });
      affectedCardIds = cardsToArchive.map((card) => card.id);

      await tx.card.updateMany({
        where: {
          listId: existingList.id,
          archivedAt: null,
        },
        data: {
          archivedAt,
          archivedByListId: null,
        },
      });

      return existingList;
    });
    relatedDependencyCardIds = await getRelatedDependencyCardIds({
      boardId,
      orgId,
      sourceCardIds: affectedCardIds,
    });

    await createAuditLog({
      entityTitle: `detail:đã lưu trữ toàn bộ thẻ trong danh sách "${list.title}"`,
      entityId: list.id,
      entityType: ENTITY_TYPE.LIST,
      action: ACTION.UPDATE,
      boardId,
    });

    await triggerCardReordered({
      boardId,
      listId: list.id,
      actorUserId: userId,
    });

    await triggerRelatedDependencyCardsUpdated({
      boardId,
      sourceCardId: list.id,
      relatedCardIds: relatedDependencyCardIds,
      actorUserId: userId,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "LIST_NOT_FOUND") {
      return {
        error: "Không tìm thấy danh sách hoặc danh sách đã được lưu trữ.",
      };
    }

    return {
      error: "Lưu trữ thẻ trong danh sách thất bại.",
    };
  }

  revalidatePath(`/board/${boardId}`);
  return { data: list };
};

export const archiveListCards = createSafeAction(ArchiveListCards, handler);
