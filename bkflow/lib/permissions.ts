import { BoardMemberRole } from "@prisma/client";
import { cache } from "react";

import { getRoleLabel } from "@/lib/board-member-role";
import { db } from "@/lib/db";

export const BOARD_MEMBER_REQUIRED_ERROR = "Bạn không phải là thành viên của bảng này.";
export const BOARD_ADMIN_REQUIRED_ERROR = "Chỉ quản trị viên mới có thể thực hiện hành động này.";

type BoardPermissionInput = {
  boardId: string;
  orgId: string;
  userId: string;
};

export const getBoardMembership = cache(async (
  boardId: string,
  orgId: string,
  userId: string,
) => {
  return db.boardMember.findUnique({
    where: {
      boardId_userId: {
        boardId,
        userId,
      },
      board: {
        orgId,
      },
    },
    include: {
      board: {
        select: {
          id: true,
          title: true,
          orgId: true,
        },
      },
    },
  });
});

export const requireBoardMember = async (input: BoardPermissionInput) => {
  const membership = await getBoardMembership(input.boardId, input.orgId, input.userId);

  if (!membership) {
    return {
      error: BOARD_MEMBER_REQUIRED_ERROR,
      membership: null,
    };
  }

  return {
    error: null,
    membership,
  };
};

export const requireBoardAdmin = async (input: BoardPermissionInput) => {
  const result = await requireBoardMember(input);

  if (result.error || !result.membership) {
    return result;
  }

  if (result.membership.role !== BoardMemberRole.ADMIN) {
    return {
      error: BOARD_ADMIN_REQUIRED_ERROR,
      membership: result.membership,
    };
  }

  return result;
};

export const isBoardAdmin = (role: BoardMemberRole) => role === BoardMemberRole.ADMIN;

export { getRoleLabel };
