"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { createSafeAction } from "@/lib/create-safe-action";
import { requireBoardMember } from "@/lib/permissions";

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

  try {
    const permission = await requireBoardMember({ boardId, orgId, userId });

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
        board: {
          orgId,
        },
      },
    });

    if (destinationListCount !== destinationListIds.length) {
      return { error: "Không thể di chuyển thẻ sang bảng khác." };
    }

    const transaction = items.map((card) => 
      db.card.update({
        where: {
          id: card.id,
          list: {
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

  revalidatePath(`/board/${boardId}`);
  return { data: updatedCards };
};

export const updateCardOrder = createSafeAction(UpdateCardOrder, handler);
