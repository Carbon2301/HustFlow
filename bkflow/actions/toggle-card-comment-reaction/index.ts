"use server";

import { auth, currentUser } from "@clerk/nextjs/server";

import { createSafeAction } from "@/lib/create-safe-action";
import { db } from "@/lib/db";
import { requireBoardMember } from "@/lib/permissions";
import {
  triggerReactionCreated,
  triggerReactionDeleted,
  triggerReactionUpdated,
} from "@/lib/comments/realtime";

import { ToggleCardCommentReaction } from "./schema";
import { InputType, ReturnType } from "./types";

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId, orgId } = await auth();
  const user = await currentUser();

  if (!userId || !orgId || !user) {
    return { error: "Không có quyền truy cập." };
  }

  const { boardId, cardId, commentId, emoji } = data;
  let reaction;

  try {
    const permission = await requireBoardMember({ boardId, orgId, userId });

    if (permission.error) {
      return { error: permission.error };
    }

    const comment = await db.cardComment.findUnique({
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
      },
    });

    if (!comment) {
      return { error: "Không tìm thấy bình luận." };
    }

    const userReactions = await db.cardCommentReaction.findMany({
      where: {
        commentId,
        userId,
      },
    });

    const existingExactReaction = userReactions.find((r) => r.emoji === emoji);

    if (existingExactReaction) {
      reaction = await db.cardCommentReaction.delete({
        where: {
          id: existingExactReaction.id,
        },
      });

      await triggerReactionDeleted({
        boardId,
        cardId,
        commentId,
        actorUserId: userId,
        reaction,
      });
    } else {
      if (userReactions.length > 0) {
        await db.cardCommentReaction.deleteMany({
          where: {
            commentId,
            userId,
          },
        });
      }

      reaction = await db.cardCommentReaction.create({
        data: {
          commentId,
          userId,
          emoji,
        },
      });

      if (userReactions.length > 0) {
        await triggerReactionUpdated({
          boardId,
          cardId,
          commentId,
          actorUserId: userId,
          reaction,
        });
      } else {
        await triggerReactionCreated({
          boardId,
          cardId,
          commentId,
          actorUserId: userId,
          reaction,
        });
      }
    }
  } catch {
    return { error: "Cập nhật cảm xúc thất bại." };
  }

  return { data: reaction };
};

export const toggleCardCommentReaction = createSafeAction(ToggleCardCommentReaction, handler);
