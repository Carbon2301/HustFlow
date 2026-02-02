"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { ACTION, BoardMemberRole, ENTITY_TYPE, NOTIFICATION_TYPE } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { createAuditLog } from "@/lib/create-audit-log";
import { createNotification } from "@/lib/create-notification";
import { createSafeAction } from "@/lib/create-safe-action";
import { db } from "@/lib/db";
import { getOrganizationMember } from "@/lib/clerk-org-members";
import { requireBoardAdmin } from "@/lib/permissions";
import { triggerBoardMemberAdded } from "@/lib/boards/realtime";

import { AddBoardMember } from "./schema";
import { InputType, ReturnType } from "./types";

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId, orgId } = await auth();
  const user = await currentUser();

  if (!userId || !orgId || !user) {
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

    const permission = await requireBoardAdmin({ boardId, orgId, userId });

    if (permission.error) {
      return { error: permission.error };
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
        role: BoardMemberRole.MEMBER,
      },
    });

    await createAuditLog({
      entityId: board.id,
      entityTitle: `detail:đã thêm ${boardMember.userName} vào bảng "${board.title}"`,
      entityType: ENTITY_TYPE.BOARD,
      action: ACTION.UPDATE,
      boardId,
    });

    await createNotification({
      orgId,
      recipientUserId: boardMember.userId,
      actor: {
        userId,
        name: user.fullName || user.username || user.primaryEmailAddress?.emailAddress || "Thành viên",
        image: user.imageUrl,
      },
      type: NOTIFICATION_TYPE.BOARD_INVITE,
      title: "Bạn được mời vào bảng",
      message: `Bạn đã được thêm vào bảng "${board.title}".`,
      boardId: board.id,
      boardTitle: board.title,
    });

    await triggerBoardMemberAdded({
      boardId,
      boardMemberId: boardMember.id,
      targetUserId: boardMember.userId,
      actorUserId: userId,
    });
  } catch {
    return { error: "Thêm thành viên vào bảng thất bại." };
  }

  revalidatePath(`/board/${boardId}`);
  return { data: boardMember };
};

export const addBoardMember = createSafeAction(AddBoardMember, handler);
