"use server";

import { auth } from "@clerk/nextjs/server";
import { ACTION, BoardMemberRole, ENTITY_TYPE } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { createAuditLog } from "@/lib/create-audit-log";
import { createSafeAction } from "@/lib/create-safe-action";
import { db } from "@/lib/db";
import { requireBoardAdmin } from "@/lib/permissions";
import { triggerBoardMemberRemoved } from "@/lib/boards/realtime";

import { RemoveBoardMember } from "./schema";
import { InputType, ReturnType } from "./types";

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId, orgId } = await auth();

  if (!userId || !orgId) {
    return { error: "Không có quyền truy cập." };
  }

  const { boardId, boardMemberId } = data;
  let boardMember;

  try {
    const permission = await requireBoardAdmin({ boardId, orgId, userId });

    if (permission.error) {
      return { error: permission.error };
    }

    boardMember = await db.boardMember.findUnique({
      where: {
        id: boardMemberId,
        board: {
          id: boardId,
          orgId,
        },
      },
      include: {
        board: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    if (!boardMember) {
      return { error: "Không tìm thấy thành viên trong bảng." };
    }

    if (boardMember.role === BoardMemberRole.ADMIN) {
      const adminCount = await db.boardMember.count({
        where: {
          boardId,
          role: BoardMemberRole.ADMIN,
        },
      });

      if (adminCount <= 1) {
        return { error: "Bảng phải có ít nhất một quản trị viên." };
      }
    }

    await db.boardMember.delete({
      where: {
        id: boardMember.id,
      },
    });

    await createAuditLog({
      entityId: boardMember.board.id,
      entityTitle: `detail:đã xóa ${boardMember.userName} khỏi bảng "${boardMember.board.title}"`,
      entityType: ENTITY_TYPE.BOARD,
      action: ACTION.UPDATE,
      boardId,
    });

    await triggerBoardMemberRemoved({
      boardId,
      orgId,
      boardMemberId: boardMember.id,
      targetUserId: boardMember.userId,
      actorUserId: userId,
    });
  } catch {
    return { error: "Xóa thành viên khỏi bảng thất bại." };
  }

  revalidatePath(`/board/${boardId}`);
  return { data: boardMember };
};

export const removeBoardMember = createSafeAction(RemoveBoardMember, handler);
