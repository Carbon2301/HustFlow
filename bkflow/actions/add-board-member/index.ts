"use server";

import { auth } from "@clerk/nextjs/server";
import { ACTION, ENTITY_TYPE } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { createAuditLog } from "@/lib/create-audit-log";
import { createSafeAction } from "@/lib/create-safe-action";
import { db } from "@/lib/db";
import { getOrganizationMember } from "@/lib/clerk-org-members";

import { AddBoardMember } from "./schema";
import { InputType, ReturnType } from "./types";

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId, orgId } = await auth();

  if (!userId || !orgId) {
    return { error: "Không có quyền truy cập." };
  }

  const { boardId, memberUserId } = data;
  let boardMember;

  try {
    const board = await db.board.findUnique({
      where: {
        id: boardId,
        orgId,
      },
      select: {
        id: true,
        title: true,
      },
    });

    if (!board) {
      return { error: "Không tìm thấy bảng." };
    }

    const orgMember = await getOrganizationMember(orgId, memberUserId);

    if (!orgMember) {
      return { error: "Người dùng không thuộc tổ chức hiện tại." };
    }

    const existingBoardMember = await db.boardMember.findUnique({
      where: {
        boardId_userId: {
          boardId,
          userId: memberUserId,
        },
      },
    });

    if (existingBoardMember) {
      return { data: existingBoardMember };
    }

    boardMember = await db.boardMember.create({
      data: {
        boardId,
        userId: orgMember.userId,
        userName: orgMember.name,
        userImage: orgMember.imageUrl,
        userEmail: orgMember.email,
      },
    });

    await createAuditLog({
      entityId: board.id,
      entityTitle: `detail:đã thêm ${boardMember.userName} vào bảng "${board.title}"`,
      entityType: ENTITY_TYPE.BOARD,
      action: ACTION.UPDATE,
    });
  } catch {
    return { error: "Thêm thành viên vào bảng thất bại." };
  }

  revalidatePath(`/board/${boardId}`);
  return { data: boardMember };
};

export const addBoardMember = createSafeAction(AddBoardMember, handler);
