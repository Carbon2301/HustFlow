"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

import { createSafeAction } from "@/lib/create-safe-action";
import { db } from "@/lib/db";

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

    const existingReaction = await db.cardCommentReaction.findUnique({
      where: {
        commentId_userId_emoji: {
          commentId,
          userId,
          emoji,
        },
      },
    });

    if (existingReaction) {
      reaction = await db.cardCommentReaction.delete({
        where: {
          id: existingReaction.id,
        },
      });
    } else {
      reaction = await db.cardCommentReaction.create({
        data: {
          commentId,
          userId,
          emoji,
        },
      });
    }
  } catch {
    return { error: "Cập nhật cảm xúc thất bại." };
  }

  revalidatePath(`/board/${boardId}`);
  return { data: reaction };
};

export const toggleCardCommentReaction = createSafeAction(ToggleCardCommentReaction, handler);
