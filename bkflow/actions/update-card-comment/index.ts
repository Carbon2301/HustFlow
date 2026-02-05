"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { ACTION, AUDIT_EVENT_TYPE, ENTITY_TYPE } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { createAuditLog } from "@/lib/create-audit-log";
import { createSafeAction } from "@/lib/create-safe-action";
import { db } from "@/lib/db";
import { requireBoardMember } from "@/lib/permissions";
import { triggerCommentUpdated } from "@/lib/comments/realtime";

import { UpdateCardComment } from "./schema";
import { InputType, ReturnType } from "./types";

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId, orgId } = await auth();
  const user = await currentUser();

  if (!userId || !orgId || !user) {
    return { error: "Không có quyền truy cập." };
  }

  const { boardId, cardId, commentId } = data;
  const content = data.content.trim();
  let comment;

  if (!content) {
    return { error: "Vui lòng nhập nội dung bình luận." };
  }

  try {
    const permission = await requireBoardMember({ boardId, orgId, userId });

    if (permission.error) {
      return { error: permission.error };
    }

    const existingComment = await db.cardComment.findUnique({
      where: {
        id: commentId,
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
        userId: true,
        content: true,
        cardId: true,
        parentId: true,
        userName: true,
        userImage: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!existingComment) {
      return { error: "Không tìm thấy bình luận." };
    }

    if (existingComment.userId !== userId) {
      return { error: "Bạn chỉ có thể chỉnh sửa bình luận của mình." };
    }

    if (existingComment.content === content) {
      comment = existingComment;
    } else {
      comment = await db.cardComment.update({
        where: {
          id: existingComment.id,
        },
        data: {
          content,
        },
      });

      await createAuditLog({
        entityId: cardId,
        entityTitle: "detail:đã cập nhật bình luận trong thẻ này",
        entityType: ENTITY_TYPE.CARD,
        action: ACTION.UPDATE,
        eventType: AUDIT_EVENT_TYPE.COMMENT,
        boardId,
        cardId,
      });

      await triggerCommentUpdated({
        boardId,
        cardId,
        actorUserId: userId,
        comment,
      });
    }
  } catch {
    return { error: "Cập nhật bình luận thất bại." };
  }

  revalidatePath(`/board/${boardId}`);
  return { data: comment };
};

export const updateCardComment = createSafeAction(UpdateCardComment, handler);
