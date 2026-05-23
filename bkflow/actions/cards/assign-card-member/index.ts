"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { ACTION, AUDIT_EVENT_TYPE, ENTITY_TYPE, NOTIFICATION_TYPE } from "@prisma/client";

import { createAuditLog } from "@/lib/create-audit-log";
import { createNotification } from "@/lib/notifications/create-notification";
import { createSafeAction } from "@/lib/create-safe-action";
import { db } from "@/lib/db";
import { getOrganizationMember } from "@/lib/clerk-org-members";
import { requireBoardEditor } from "@/lib/permissions";
import { triggerCardMemberAssigned } from "@/lib/cards/realtime";

import { AssignCardMember } from "./schema";
import { InputType, ReturnType } from "./types";

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId, orgId } = await auth();
  const user = await currentUser();

  if (!userId || !orgId || !user) {
    return { error: "Không có quyền truy cập." };
  }

  const { boardId, cardId, boardMemberId } = data;
  let cardAssignee;

  try {
    const permission = await requireBoardEditor({ boardId, orgId, userId });

    if (permission.error) {
      return { error: permission.error };
    }

    const card = await db.card.findUnique({
      where: {
        id: cardId,
        list: {
          board: {
            id: boardId,
            orgId,
          },
        },
      },
      select: {
        id: true,
        title: true,
        list: {
          select: {
            title: true,
            boardId: true,
            board: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
      },
    });

    if (!card) {
      return { error: "Không tìm thấy thẻ." };
    }

    const boardMember = await db.boardMember.findUnique({
      where: {
        id: boardMemberId,
        board: {
          id: boardId,
          orgId,
        },
      },
    });

    if (!boardMember) {
      return { error: "Không tìm thấy thành viên trong bảng." };
    }

    const orgMember = await getOrganizationMember(orgId, boardMember.userId);

    if (!orgMember) {
      return { error: "Người dùng không thuộc tổ chức hiện tại." };
    }

    const existingAssignee = await db.cardAssignee.findUnique({
      where: {
        cardId_boardMemberId: {
          cardId,
          boardMemberId,
        },
      },
      include: {
        boardMember: true,
      },
    });

    if (existingAssignee) {
      return { data: existingAssignee };
    }

    cardAssignee = await db.cardAssignee.create({
      data: {
        cardId,
        boardMemberId,
      },
      include: {
        boardMember: true,
      },
    });

    await createAuditLog({
      entityId: card.id,
      entityTitle: `detail:đã giao ${boardMember.userName} cho thẻ "${card.title}"`,
      entityType: ENTITY_TYPE.CARD,
      action: ACTION.UPDATE,
      eventType: AUDIT_EVENT_TYPE.ASSIGN_MEMBER,
      boardId,
      cardId: card.id,
    });

    await createNotification({
      orgId,
      recipientUserId: boardMember.userId,
      actor: {
        userId,
        name: user.fullName || user.username || user.primaryEmailAddress?.emailAddress || "Thành viên",
        image: user.imageUrl,
      },
      type: NOTIFICATION_TYPE.CARD_ASSIGNED,
      title: "Bạn được giao một thẻ",
      message: `Bạn đã được giao thẻ "${card.title}".`,
      boardId: card.list.board.id,
      boardTitle: card.list.board.title,
      cardId: card.id,
      cardTitle: card.title,
      listTitle: card.list.title,
    });

    await triggerCardMemberAssigned({
      boardId,
      cardId: card.id,
      actorUserId: userId,
      assignee: cardAssignee,
    });
  } catch {
    return { error: "Giao thành viên cho thẻ thất bại." };
  }

  return { data: cardAssignee };
};

export const assignCardMember = createSafeAction(AssignCardMember, handler);
