"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { createSafeAction } from "@/lib/create-safe-action";

import { UpdateBoard } from "./schema";
import { InputType, ReturnType } from "./types";
import { createAuditLog } from "@/lib/create-audit-log";
import { ACTION, ENTITY_TYPE } from "@prisma/client";
import { requireBoardAdmin } from "@/lib/permissions";
import { triggerBoardUpdated } from "@/lib/boards/realtime";

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId, orgId } = await auth();

  if (!userId || !orgId) {
    return {
      error: "Không có quyền truy cập.",
    };
  }

  const { title, id } = data;
  let board;

  try {
    const permission = await requireBoardAdmin({ boardId: id, orgId, userId });

    if (permission.error) {
      return { error: permission.error };
    }

    const currentBoard = await db.board.findUnique({
      where: {
        id,
        orgId,
      },
    });

    if (!currentBoard) {
      return { error: "Không tìm thấy bảng." };
    }

    if (currentBoard.title === title) {
      return { data: currentBoard };
    }

    board = await db.board.update({
      where: {
        id,
        orgId,
      },
      data: {
        title,
      },
    });

    await createAuditLog({
      entityTitle: board.title,
      entityId: board.id,
      entityType: ENTITY_TYPE.BOARD,
      action: ACTION.UPDATE,
    })

    await triggerBoardUpdated({
      boardId: board.id,
      orgId,
      actorUserId: userId,
      title: board.title,
      changedFields: ["title"],
    });
  } catch {
    return {
      error: "Cập nhật bảng thất bại."
    }
  }

  revalidatePath(`/board/${id}`);
  return { data: board };
};

export const updateBoard = createSafeAction(UpdateBoard, handler);
