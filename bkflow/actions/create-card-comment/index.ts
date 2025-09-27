"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

import { createSafeAction } from "@/lib/create-safe-action";
import { db } from "@/lib/db";

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
  let comment;

  if (!content) {
    return { error: "Vui lòng nhập nội dung bình luận." };
  }

  try {
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
      },
    });

    if (!card) {
      return { error: "Không tìm thấy thẻ." };
    }

    if (parentId) {
      const parentComment = await db.cardComment.findUnique({
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
  } catch {
    return { error: "Tạo bình luận thất bại." };
  }

  revalidatePath(`/board/${boardId}`);
  return { data: comment };
};

export const createCardComment = createSafeAction(CreateCardComment, handler);
