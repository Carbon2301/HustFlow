"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import {
  ACTION,
  AUDIT_EVENT_TYPE,
  BoardMemberRole,
  ENTITY_TYPE,
  type BoardMember,
} from "@prisma/client";
import { revalidatePath } from "next/cache";

import { createSafeAction } from "@/lib/create-safe-action";
import { db } from "@/lib/db";
import { triggerBoardMemberRemoved } from "@/lib/boards/realtime";

import { LeaveBoard } from "./schema";
import { InputType, ReturnType as ActionReturnType } from "./types";

type CurrentUser = NonNullable<Awaited<ReturnType<typeof currentUser>>>;
type LeavingBoardMember = BoardMember & {
  board: {
    id: string;
    title: string;
    orgId: string;
  };
};

const getUserDisplayName = (user: CurrentUser) => {
  const fullName = user.fullName?.trim();

  if (fullName) {
    return fullName;
  }

  const name = [user.firstName, user.lastName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");

  if (name) {
    return name;
  }

  const email =
    user.emailAddresses.find((emailAddress) => emailAddress.id === user.primaryEmailAddressId)?.emailAddress ??
    user.emailAddresses[0]?.emailAddress;

  return email?.trim() || "Unknown user";
};

const handler = async (data: InputType): Promise<ActionReturnType> => {
  const { userId, orgId } = await auth();
  const user = await currentUser();

  if (!userId || !orgId || !user) {
    return { error: "Không có quyền truy cập." };
  }

  const { boardId } = data;
  let boardMember: LeavingBoardMember;

  try {
    const existingBoardMember = await db.boardMember.findUnique({
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

    if (!existingBoardMember) {
      return { error: "Không tìm thấy thành viên trong bảng." };
    }

    boardMember = existingBoardMember;

    if (boardMember.role === BoardMemberRole.ADMIN) {
      const adminCount = await db.boardMember.count({
        where: {
          boardId,
          role: BoardMemberRole.ADMIN,
        },
      });

      if (adminCount <= 1) {
        return {
          error: "Bảng phải có ít nhất một quản trị viên. Vui lòng chuyển quyền quản trị cho người khác trước khi rời bảng.",
        };
      }
    }

    await db.$transaction(async (tx) => {
      await tx.boardMember.delete({
        where: {
          id: boardMember.id,
        },
      });

      await tx.auditLog.create({
        data: {
          orgId,
          boardId,
          entityId: boardMember.board.id,
          entityType: ENTITY_TYPE.BOARD,
          entityTitle: `detail:đã rời khỏi bảng "${boardMember.board.title}"`,
          action: ACTION.UPDATE,
          eventType: AUDIT_EVENT_TYPE.ASSIGN_MEMBER,
          userId,
          userImage: user.imageUrl,
          userName: getUserDisplayName(user),
        },
      });
    });

    await triggerBoardMemberRemoved({
      boardId,
      orgId,
      boardMemberId: boardMember.id,
      targetUserId: boardMember.userId,
      actorUserId: userId,
    });
  } catch {
    return { error: "Rời khỏi bảng thất bại." };
  }

  revalidatePath(`/board/${boardId}`);
  revalidatePath(`/organization/${orgId}`);
  return { data: boardMember };
};

export const leaveBoard = createSafeAction(LeaveBoard, handler);
