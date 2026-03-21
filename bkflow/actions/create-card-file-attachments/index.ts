"use server";

import { auth } from "@clerk/nextjs/server";
import { ACTION, AUDIT_EVENT_TYPE, AttachmentType, ENTITY_TYPE } from "@prisma/client";

import { createSafeAction } from "@/lib/create-safe-action";
import { createAuditLog } from "@/lib/create-audit-log";
import { triggerAttachmentCreated } from "@/lib/cards/realtime";
import { db } from "@/lib/db";
import { requireBoardMember } from "@/lib/permissions";
import { utapi } from "@/lib/uploadthing-server";

import { CreateCardFileAttachments } from "./schema";
import { InputType, ReturnType } from "./types";

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId, orgId } = await auth();

  if (!userId || !orgId) {
    return {
      error: "KhÃ´ng cÃ³ quyá»n truy cáº­p.",
    };
  }

  const { cardId, boardId, files } = data;
  const fileKeys = files.map((file) => file.fileKey);

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
        error: "KhÃ´ng tÃ¬m tháº¥y tháº».",
      };
    }

    let attachments;

    try {
      attachments = await db.$transaction(async (tx) => {
        const highestOrderAttachment = await tx.cardAttachment.aggregate({
          where: {
            cardId: card.id,
            type: AttachmentType.FILE,
          },
          _max: {
            order: true,
          },
        });

        const startOrder = (highestOrderAttachment._max.order ?? -1) + 1;

        return Promise.all(
          files.map((file, index) =>
            tx.cardAttachment.create({
              data: {
                cardId: card.id,
                type: AttachmentType.FILE,
                order: startOrder + index,
                name: file.name,
                url: file.url,
                fileKey: file.fileKey,
                fileSize: file.fileSize,
                mimeType: file.mimeType,
              },
            }),
          ),
        );
      });
    } catch (error) {
      console.error("[CREATE_CARD_FILE_ATTACHMENTS_DB_ERROR]", {
        error,
        cardId,
        boardId,
        fileKeys,
      });

      try {
        await utapi.deleteFiles(fileKeys);
        console.info("[CREATE_CARD_FILE_ATTACHMENTS_ROLLBACK_SUCCESS]", {
          fileKeys,
          cardId,
          boardId,
        });
      } catch (cleanupError) {
        console.error("[CREATE_CARD_FILE_ATTACHMENTS_ROLLBACK_ERROR]", {
          error: cleanupError,
          fileKeys,
          cardId,
          boardId,
        });
      }

      return {
        error: "LÆ°u file Ä‘Ã­nh kÃ¨m tháº¥t báº¡i.",
      };
    }

    await Promise.all(
      attachments.map((attachment) =>
        createAuditLog({
          entityId: card.id,
          entityType: ENTITY_TYPE.CARD,
          entityTitle: `detail:Ä‘Ã£ Ä‘Ã­nh kÃ¨m táº­p tin "${attachment.name}" vÃ o tháº» "${card.title}"`,
          action: ACTION.UPDATE,
          eventType: AUDIT_EVENT_TYPE.ATTACHMENT,
          boardId,
          cardId: card.id,
        }),
      ),
    );

    await Promise.all(
      attachments.map((attachment) =>
        triggerAttachmentCreated({
          boardId,
          cardId: card.id,
          actorUserId: userId,
          attachment,
        }),
      ),
    );

    return { data: attachments };
  } catch (error) {
    console.error("[CREATE_CARD_FILE_ATTACHMENTS_ERROR]", error);
    return {
      error: "LÆ°u file Ä‘Ã­nh kÃ¨m tháº¥t báº¡i.",
    };
  }
};

export const createCardFileAttachments = createSafeAction(CreateCardFileAttachments, handler);
