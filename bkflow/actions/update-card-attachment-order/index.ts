"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

import { triggerAttachmentReordered } from "@/lib/cards/realtime";
import { createSafeAction } from "@/lib/create-safe-action";
import { db } from "@/lib/db";
import { requireBoardMember } from "@/lib/permissions";

import { UpdateCardAttachmentOrder } from "./schema";
import { InputType, ReturnType } from "./types";

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId, orgId } = await auth();

  if (!userId || !orgId) {
    return {
      error: "Không có quyền truy cập.",
    };
  }

  const { boardId, cardId, type, items } = data;

  try {
    const permission = await requireBoardMember({ boardId, orgId, userId });

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
      },
    });

    if (!card) {
      return {
        error: "Không tìm thấy thẻ.",
      };
    }

    const uniqueAttachmentIds = new Set(items.map((item) => item.id));

    if (uniqueAttachmentIds.size !== items.length) {
      return {
        error: "Danh sách đính kèm có mục trùng lặp.",
      };
    }

    const attachments = await db.cardAttachment.findMany({
      where: {
        id: {
          in: Array.from(uniqueAttachmentIds),
        },
        cardId: card.id,
        type,
      },
      select: {
        id: true,
      },
    });

    if (attachments.length !== items.length) {
      return {
        error: "Không thể sắp xếp đính kèm khác loại hoặc không thuộc thẻ này.",
      };
    }

    const updatedAttachments = await db.$transaction(
      items.map((item) =>
        db.cardAttachment.update({
          where: {
            id: item.id,
          },
          data: {
            order: item.order,
          },
        }),
      ),
    );

    revalidatePath(`/board/${boardId}`);

    await triggerAttachmentReordered({
      boardId,
      cardId,
      actorUserId: userId,
      attachmentType: type,
    });

    return { data: updatedAttachments };
  } catch (error) {
    console.error("[UPDATE_CARD_ATTACHMENT_ORDER_ERROR]", error);
    return {
      error: "Sắp xếp đính kèm thất bại.",
    };
  }
};

export const updateCardAttachmentOrder = createSafeAction(
  UpdateCardAttachmentOrder,
  handler,
);
