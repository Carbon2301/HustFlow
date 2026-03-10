"use server";

import { auth } from "@clerk/nextjs/server";
import { ACTION, AUDIT_EVENT_TYPE, ENTITY_TYPE } from "@prisma/client";

import { createAuditLog } from "@/lib/create-audit-log";
import { db } from "@/lib/db";
import { createSafeAction } from "@/lib/create-safe-action";
import { requireBoardMember } from "@/lib/permissions";
import { triggerListReordered } from "@/lib/boards/realtime";

import { UpdateListOrder } from "./schema";
import { InputType, ReturnType } from "./types";

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId, orgId } = await auth();

  if (!userId || !orgId) {
    return {
      error: "Không có quyền truy cập.",
    };
  }

  const { items, boardId } = data;
  let lists;
  let changedLists: typeof items = [];
  let shouldTriggerRealtime = false;

  try {
    const permission = await requireBoardMember({ boardId, orgId, userId });

    if (permission.error) {
      return { error: permission.error };
    }

    const existingLists = await db.list.findMany({
      where: {
        id: {
          in: items.map((list) => list.id),
        },
        boardId,
        archivedAt: null,
        board: {
          orgId,
        },
      },
    });

    if (existingLists.length !== items.length) {
      return { error: "KhÃ´ng thá»ƒ sáº¯p xáº¿p danh sÃ¡ch khÃ´ng thuá»™c báº£ng nÃ y." };
    }

    const nextOrderById = new Map(items.map((list) => [list.id, list.order]));
    shouldTriggerRealtime = existingLists.some(
      (list) => nextOrderById.get(list.id) !== list.order,
    );

    if (!shouldTriggerRealtime) {
      return { data: existingLists };
    }

    changedLists = items.filter((list) => {
      const currentList = existingLists.find((item) => item.id === list.id);

      return currentList && currentList.order !== list.order;
    });

    const transaction = changedLists.map((list) => 
      db.list.update({
        where: {
          id: list.id,
          archivedAt: null,
          board: {
            id: boardId,
            orgId,
          },
        },
        data: {
          order: list.order,
        },
      })
    );

    lists = await db.$transaction(transaction);
  } catch {
    return {
      error: "Thay đổi thứ tự danh sách thất bại."
    }
  }

  await createAuditLog({
    entityId: boardId,
    entityTitle: "detail:đã sắp xếp lại thứ tự danh sách",
    entityType: ENTITY_TYPE.BOARD,
    action: ACTION.UPDATE,
    eventType: AUDIT_EVENT_TYPE.MOVE,
    boardId,
  });

  await triggerListReordered({
    boardId,
    actorUserId: userId,
    orderedListIds: [...items]
      .sort((a, b) => a.order - b.order)
      .map((list) => list.id),
  });

  return { data: lists };
};

export const updateListOrder = createSafeAction(UpdateListOrder, handler);
