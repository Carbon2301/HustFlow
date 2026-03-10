"use server";

import { auth } from "@clerk/nextjs/server";
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

  const { title, boardId, listId, startDate, dueDate } = data;
  let card;

  try {
    const permission = await requireBoardMember({ boardId, orgId, userId });

    if (permission.error) {
      return { error: permission.error };
    }

    const list = await db.list.findFirst({
      where: {
        id: listId,
        archivedAt: null,
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
      where: {
        listId,
        archivedAt: null,
      },
      orderBy: { order: "desc" },
      select: { order: true },
    });

    const newOrder = lastCard ? lastCard.order + 1 : 1;

    if (
      startDate &&
      dueDate &&
      dueDate.getTime() - startDate.getTime() < 15 * 60_000
    ) {
      return {
        error: "Khoảng thời gian tối thiểu là 15 phút.",
      };
    }

    card = await db.card.create({
      data: {
        title,
        listId,
        order: newOrder,
        ...(startDate !== undefined ? { startDate } : {}),
        ...(dueDate !== undefined ? { dueDate } : {}),
      },
    });

    await createAuditLog({
      entityId: card.id,
      entityTitle: `detail:đã thêm thẻ "${card.title}" vào danh sách "${list.title}"`,
      entityType: ENTITY_TYPE.CARD,
      action: ACTION.CREATE,
      boardId,
      cardId: card.id,
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

  return { data: card };
};

export const createCard = createSafeAction(CreateCard, handler);
