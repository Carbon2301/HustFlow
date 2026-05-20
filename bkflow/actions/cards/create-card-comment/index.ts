"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { ACTION, AUDIT_EVENT_TYPE, CardComment, ENTITY_TYPE, NOTIFICATION_TYPE } from "@prisma/client";

import { createNotifications } from "@/lib/create-notification";
import { createAuditLog } from "@/lib/create-audit-log";
import { createSafeAction } from "@/lib/create-safe-action";
import { db } from "@/lib/db";
import { findMentionedBoardMembers } from "@/lib/mentions";
import { requireBoardEditor } from "@/lib/permissions";
import { triggerCommentCreated } from "@/lib/comments/realtime";

import { CreateCardComment } from "./schema";
import { InputType, ReturnType } from "./types";

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId, orgId } = await auth();
  const user = await currentUser();

  if (!userId || !orgId || !user) {
    return { error: "Không có quyền truy cập." };
  }

  const { boardId, cardId, parentId } = data;
  const content = data.content.trim();
  let comment: CardComment;
  let parentComment:
    | {
      id: string;
      parentId: string | null;
      userId: string;
    }
    | null = null;

  if (!content) {
    return { error: "Vui lòng nhập nội dung bình luận." };
  }

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
            board: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
        assignees: {
          include: {
            boardMember: true,
          },
        },
      },
    });

    if (!card) {
      return { error: "Không tìm thấy thẻ." };
    }

    if (parentId) {
      parentComment = await db.cardComment.findUnique({
        where: {
          id: parentId,
          card: {
            id: cardId,
            list: {
              board: {
                id: boardId,
                orgId,
              },
            },
          },
        },
        select: {
          id: true,
          parentId: true,
          userId: true,
        },
      });

      if (!parentComment) {
        return { error: "Không tìm thấy bình luận gốc." };
      }

      if (parentComment.parentId) {
        return { error: "Chỉ hỗ trợ trả lời một cấp." };
      }
    }

    comment = await db.cardComment.create({
      data: {
        cardId,
        content,
        parentId: parentId || null,
        userId,
        userName: user.fullName || user.username || user.primaryEmailAddress?.emailAddress || "Người dùng",
        userImage: user.imageUrl,
      },
    });

    const boardMembers = await db.boardMember.findMany({
      where: {
        boardId,
      },
    });

    const mentionKeys = new Set(
      Array.from(content.matchAll(/@([\p{L}\p{N}_-]+)/gu)).map((match) =>
        match[1].toLowerCase()
      )
    );

    const recipientIds = new Set<string>();
    const notifications = [];
    const actor = {
      userId,
      name: user.fullName || user.username || user.primaryEmailAddress?.emailAddress || "Thành viên",
      image: user.imageUrl,
    };

    if (parentComment && parentComment.userId !== userId) {
      recipientIds.add(parentComment.userId);
      notifications.push({
        orgId,
        recipientUserId: parentComment.userId,
        actor,
        type: NOTIFICATION_TYPE.COMMENT_REPLY,
        title: "Có phản hồi mới",
        message: `${actor.name} đã trả lời bình luận của bạn trong thẻ "${card.title}".`,
        boardId: card.list.board.id,
        boardTitle: card.list.board.title,
        cardId: card.id,
        cardTitle: card.title,
        listTitle: card.list.title,
        commentId: comment.id,
      });
    }

    const targetMembers = new Map<string, typeof boardMembers[number]>();

    if (mentionKeys.has("board")) {
      boardMembers.forEach((m) => targetMembers.set(m.userId, m));
    }
    if (mentionKeys.has("card")) {
      card.assignees.forEach((a) => targetMembers.set(a.boardMember.userId, a.boardMember));
    }
    
    const individualMentions = findMentionedBoardMembers(content, boardMembers);
    individualMentions.forEach((m) => targetMembers.set(m.userId, m));

    targetMembers.forEach((member) => {
      if (member.userId === userId || recipientIds.has(member.userId)) {
        return;
      }

      recipientIds.add(member.userId);
      notifications.push({
        orgId,
        recipientUserId: member.userId,
        actor,
        type: NOTIFICATION_TYPE.COMMENT_MENTION,
        title: "Bạn được nhắc đến",
        message: `${actor.name} đã nhắc đến bạn trong thẻ "${card.title}".`,
        boardId: card.list.board.id,
        boardTitle: card.list.board.title,
        cardId: card.id,
        cardTitle: card.title,
        listTitle: card.list.title,
        commentId: comment.id,
      });
    });

    await createNotifications(notifications);

    await createAuditLog({
      entityId: card.id,
      entityTitle: parentId
        ? `detail:đã trả lời bình luận trong thẻ "${card.title}"`
        : `detail:đã bình luận trong thẻ "${card.title}"`,
      entityType: ENTITY_TYPE.CARD,
      action: ACTION.UPDATE,
      eventType: AUDIT_EVENT_TYPE.COMMENT,
      boardId,
      cardId: card.id,
    });

    await triggerCommentCreated({
      boardId,
      cardId,
      actorUserId: userId,
      comment,
    });
  } catch {
    return { error: "Tạo bình luận thất bại." };
  }

  return { data: comment };
};

export const createCardComment = createSafeAction(CreateCardComment, handler);
