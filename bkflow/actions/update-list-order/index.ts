"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

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

    const transaction = items.map((list) => 
      db.list.update({
        where: {
          id: list.id,
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

  revalidatePath(`/board/${boardId}`);
  await triggerListReordered({
    boardId,
    actorUserId: userId,
  });

  return { data: lists };
};

export const updateListOrder = createSafeAction(UpdateListOrder, handler);
