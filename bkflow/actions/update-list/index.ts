"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { createSafeAction } from "@/lib/create-safe-action";

import { UpdateList } from "./schema";
import { InputType, ReturnType } from "./types";
import { createAuditLog } from "@/lib/create-audit-log";
import { ACTION, ENTITY_TYPE } from "@prisma/client";
import { requireBoardMember } from "@/lib/permissions";
import { triggerListUpdated } from "@/lib/boards/realtime";

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId, orgId } = await auth();

  if (!userId || !orgId) {
    return {
      error: "Không có quyền truy cập.",
    };
  }

  const { title, id, boardId } = data;
  let list;

  try {
    const permission = await requireBoardMember({ boardId, orgId, userId });

    if (permission.error) {
      return { error: permission.error };
    }

    const existingList = await db.list.findFirst({
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
      return { error: "Không tìm thấy danh sách." };
    }

    if (existingList.title === title) {
      return { data: existingList };
    }

    list = await db.list.update({
      where: {
        id,
        boardId,
        archivedAt: null,
        board: {
          orgId,
        },
      },
      data: {
        title,
      },
    });

    await createAuditLog({
      entityTitle: list.title,
      entityId: list.id,
      entityType: ENTITY_TYPE.LIST,
      action: ACTION.UPDATE,
      boardId,
    })

    await triggerListUpdated({
      boardId,
      listId: list.id,
      actorUserId: userId,
      title: list.title,
    });
  } catch {
    return {
      error: "Cập nhật danh sách thất bại."
    }
  }

  revalidatePath(`/board/${boardId}`);
  return { data: list };
};

export const updateList = createSafeAction(UpdateList, handler);
