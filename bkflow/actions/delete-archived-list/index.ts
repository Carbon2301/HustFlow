"use server";

import { auth } from "@clerk/nextjs/server";
import { ACTION, ENTITY_TYPE } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { createAuditLog } from "@/lib/create-audit-log";
import { createSafeAction } from "@/lib/create-safe-action";
import { db } from "@/lib/db";
import { requireBoardMember } from "@/lib/permissions";
import { triggerListDeleted } from "@/lib/boards/realtime";

import { DeleteArchivedList } from "./schema";
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

  try {
    const permission = await requireBoardMember({ boardId, orgId, userId });

    if (permission.error) {
      return { error: permission.error };
    }

    list = await db.$transaction(async (tx) => {
      const existingList = await tx.list.findFirst({
        where: {
          id,
          boardId,
          archivedAt: {
            not: null,
          },
          board: {
            orgId,
          },
        },
      });

      if (!existingList) {
        throw new Error("LIST_NOT_FOUND");
      }

      return tx.list.delete({
        where: {
          id: existingList.id,
        },
      });
    });

    await createAuditLog({
      entityTitle: `detail:đã xóa vĩnh viễn danh sách "${list.title}"`,
      entityId: list.id,
      entityType: ENTITY_TYPE.LIST,
      action: ACTION.DELETE,
      boardId,
    });

    await triggerListDeleted({
      boardId,
      listId: list.id,
      actorUserId: userId,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "LIST_NOT_FOUND") {
      return {
        error: "Không tìm thấy danh sách đã lưu trữ.",
      };
    }

    return {
      error: "Xóa vĩnh viễn danh sách thất bại.",
    };
  }

  revalidatePath(`/board/${boardId}`);
  return { data: list };
};

export const deleteArchivedList = createSafeAction(DeleteArchivedList, handler);
