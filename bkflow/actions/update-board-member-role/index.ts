"use server";

import { auth } from "@clerk/nextjs/server";
import { ACTION, AUDIT_EVENT_TYPE, BoardMemberRole, ENTITY_TYPE } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { createAuditLog } from "@/lib/create-audit-log";
import { createSafeAction } from "@/lib/create-safe-action";
import { db } from "@/lib/db";
import { getRoleLabel } from "@/lib/board-member-role";
import { requireBoardAdmin } from "@/lib/permissions";
import { triggerBoardMemberRoleUpdated } from "@/lib/boards/realtime";

import { UpdateBoardMemberRole } from "./schema";
import { InputType, ReturnType } from "./types";

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId, orgId } = await auth();

  if (!userId || !orgId) {
    return { error: "Không có quyền truy cập." };
  }

  const { boardId, boardMemberId, role } = data;
  let boardMember;

  try {
    const permission = await requireBoardAdmin({ boardId, orgId, userId });

    if (permission.error) {
      return { error: permission.error };
    }

    const existingBoardMember = await db.boardMember.findUnique({
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

    if (!existingBoardMember) {
      return { error: "Không tìm thấy thành viên trong bảng." };
    }

    if (existingBoardMember.role === role) {
      return { error: "Thành viên đã có vai trò này." };
    }

    if (
      existingBoardMember.role === BoardMemberRole.ADMIN &&
      role === BoardMemberRole.MEMBER
    ) {
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

    boardMember = await db.boardMember.update({
      where: {
        id: existingBoardMember.id,
      },
      data: {
        role,
      },
    });

    const actionLabel =
      role === BoardMemberRole.ADMIN ? "đã thăng quyền" : "đã hạ quyền";

    await createAuditLog({
      entityId: existingBoardMember.board.id,
      entityTitle: `detail:${actionLabel} ${existingBoardMember.userName} thành ${getRoleLabel(role).toLowerCase()} trong bảng "${existingBoardMember.board.title}"`,
      entityType: ENTITY_TYPE.BOARD,
      action: ACTION.UPDATE,
      eventType: AUDIT_EVENT_TYPE.ASSIGN_MEMBER,
      boardId,
    });

    await triggerBoardMemberRoleUpdated({
      boardId,
      boardMemberId: boardMember.id,
      targetUserId: boardMember.userId,
      actorUserId: userId,
      role,
    });
  } catch {
    return { error: "Cập nhật vai trò thành viên thất bại." };
  }

  revalidatePath(`/board/${boardId}`);
  return { data: boardMember };
};

export const updateBoardMemberRole = createSafeAction(UpdateBoardMemberRole, handler);
