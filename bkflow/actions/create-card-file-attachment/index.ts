"use server";

import { auth } from "@clerk/nextjs/server";
import { ACTION, AUDIT_EVENT_TYPE, AttachmentType, ENTITY_TYPE } from "@prisma/client";

import { createSafeAction } from "@/lib/create-safe-action";
import { createAuditLog } from "@/lib/create-audit-log";
import { triggerAttachmentCreated } from "@/lib/cards/realtime";
import { db } from "@/lib/db";
import { requireBoardMember } from "@/lib/permissions";
import { utapi } from "@/lib/uploadthing-server";

import { CreateCardFileAttachment } from "./schema";
import { InputType, ReturnType } from "./types";

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId, orgId } = await auth();

  if (!userId || !orgId) {
    return {
      error: "Không có quyền truy cập.",
    };
  }

  const {
    cardId,
    boardId,
    name,
    url,
    fileKey,
    fileSize,
    mimeType,
  } = data;

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
        title: true,
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
        type: AttachmentType.FILE,
      },
      _max: {
        order: true,
      },
    });

    let attachment;

    try {
      attachment = await db.cardAttachment.create({
        data: {
          cardId: card.id,
          type: AttachmentType.FILE,
          order: (highestOrderAttachment._max.order ?? -1) + 1,
          name,
          url,
          fileKey,
          fileSize,
          mimeType,
        },
      });
    } catch (error) {
      console.error("[CREATE_CARD_FILE_ATTACHMENT_DB_ERROR]", {
        error,
        cardId,
        boardId,
        fileKey,
        name,
      });

      if (fileKey) {
        try {
          await utapi.deleteFiles(fileKey);
          console.info("[CREATE_CARD_FILE_ATTACHMENT_ROLLBACK_SUCCESS]", {
            fileKey,
            cardId,
            boardId,
          });
        } catch (cleanupError) {
          console.error("[CREATE_CARD_FILE_ATTACHMENT_ROLLBACK_ERROR]", {
            error: cleanupError,
            fileKey,
            cardId,
            boardId,
          });
        }
      }

      return {
        error: "Lưu file đính kèm thất bại.",
      };
    }

    await createAuditLog({
      entityId: card.id,
      entityType: ENTITY_TYPE.CARD,
      entityTitle: `detail:đã đính kèm tập tin "${attachment.name}" vào thẻ "${card.title}"`,
      action: ACTION.UPDATE,
      eventType: AUDIT_EVENT_TYPE.ATTACHMENT,
      boardId,
      cardId: card.id,
    });

    await triggerAttachmentCreated({
      boardId,
      cardId: card.id,
      actorUserId: userId,
      attachment,
    });

    return { data: attachment };
  } catch (error) {
    console.error("[CREATE_CARD_FILE_ATTACHMENT_ERROR]", error);
    return {
      error: "Lưu file đính kèm thất bại.",
    };
  }
};

export const createCardFileAttachment = createSafeAction(CreateCardFileAttachment, handler);
