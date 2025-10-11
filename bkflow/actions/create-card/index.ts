"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { ACTION, ENTITY_TYPE } from "@prisma/client";

import { db } from "@/lib/db";
import { createAuditLog } from "@/lib/create-audit-log";
import { createSafeAction } from "@/lib/create-safe-action";
import { requireBoardMember } from "@/lib/permissions";
import { triggerCardCreated } from "@/lib/boards/realtime";

import { CreateCard } from "./schema";
import { InputType, ReturnType } from "./types";

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId, orgId } = await auth();

  if (!userId || !orgId) {
    return {
      error: "Không có quyền truy cập.",
    };
  }

  const { title, boardId, listId } = data;
  let card;

  try {
    const permission = await requireBoardMember({ boardId, orgId, userId });

    if (permission.error) {
      return { error: permission.error };
    }

    const list = await db.list.findUnique({
      where: {
        id: listId,
        board: {
          id: boardId,
          orgId,
        },
      },
    });

    if (!list) {
      return {
        error: "Không tìm thấy danh sách.",
      };
    }

    const lastCard = await db.card.findFirst({
      where: { listId },
      orderBy: { order: "desc" },
      select: { order: true },
    });

    const newOrder = lastCard ? lastCard.order + 1 : 1;

    card = await db.card.create({
      data: {
        title,
        listId,
        order: newOrder,
      },
    });

    await createAuditLog({
      entityId: card.id,
      entityTitle: card.title,
      entityType: ENTITY_TYPE.CARD,
      action: ACTION.CREATE,
    });

    await triggerCardCreated({
      boardId,
      listId,
      cardId: card.id,
      actorUserId: userId,
    });
  } catch {
    return {
      error: "Tạo thẻ thất bại."
    }
  }

  revalidatePath(`/board/${boardId}`);
  return { data: card };
};

export const createCard = createSafeAction(CreateCard, handler);
