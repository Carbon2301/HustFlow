"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

import { createSafeAction } from "@/lib/create-safe-action";
import { db } from "@/lib/db";
import { requireBoardMember } from "@/lib/permissions";

import { DeleteCardComment } from "./schema";
import { InputType, ReturnType } from "./types";

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId, orgId } = await auth();
  const user = await currentUser();

  if (!userId || !orgId || !user) {
    return { error: "Không có quyền truy cập." };
  }

  const { boardId, cardId, commentId } = data;
  let comment;

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
    });

    if (!existingComment) {
      return { error: "Không tìm thấy bình luận." };
    }

    // Xóa các thông báo chưa đọc liên quan đến bình luận này
    await db.notification.deleteMany({
      where: {
        commentId: existingComment.id,
        readAt: null,
      },
    });

    comment = await db.cardComment.delete({
      where: {
        id: existingComment.id,
      },
    });
  } catch {
    return { error: "Xóa bình luận thất bại." };
  }

  revalidatePath(`/board/${boardId}`);
  return { data: comment };
};

export const deleteCardComment = createSafeAction(DeleteCardComment, handler);
