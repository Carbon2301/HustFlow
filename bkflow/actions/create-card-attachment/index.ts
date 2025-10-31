"use server";

import { auth } from "@clerk/nextjs/server";
import { ACTION, AttachmentType, ENTITY_TYPE } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { createSafeAction } from "@/lib/create-safe-action";
import { createAuditLog } from "@/lib/create-audit-log";
import { triggerAttachmentCreated } from "@/lib/cards/realtime";
import { db } from "@/lib/db";
import { requireBoardMember } from "@/lib/permissions";

import { CreateCardAttachment } from "./schema";
import { InputType, ReturnType } from "./types";

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId, orgId } = await auth();

  if (!userId || !orgId) {
    return {
      error: "Không có quyền truy cập.",
    };
  }

  const { cardId, boardId, url } = data;
  const name = data.name?.trim() || url;

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

    const highestOrderAttachment = await db.cardAttachment.aggregate({
      where: {
        cardId: card.id,
        type: AttachmentType.LINK,
      },
      _max: {
        order: true,
      },
    });

    const attachment = await db.cardAttachment.create({
      data: {
        cardId: card.id,
        type: AttachmentType.LINK,
        order: (highestOrderAttachment._max.order ?? -1) + 1,
        name,
        url,
      },
    });

    await createAuditLog({
      entityId: card.id,
      entityType: ENTITY_TYPE.CARD,
      entityTitle: `detail:đã thêm đính kèm "${attachment.name}"`,
      action: ACTION.UPDATE,
      cardId: card.id,
    });

    await triggerAttachmentCreated({
      boardId,
      cardId: card.id,
      actorUserId: userId,
      attachment,
    });

    revalidatePath(`/board/${boardId}`);
    return { data: attachment };
  } catch (error) {
    console.error("[CREATE_CARD_ATTACHMENT_ERROR]", error);
    return {
      error: "Thêm liên kết đính kèm thất bại.",
    };
  }
};

export const createCardAttachment = createSafeAction(CreateCardAttachment, handler);
