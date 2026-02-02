"use server";

import { auth } from "@clerk/nextjs/server";
import { ACTION, AttachmentType, ENTITY_TYPE } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { createSafeAction } from "@/lib/create-safe-action";
import { createAuditLog } from "@/lib/create-audit-log";
import { triggerAttachmentDeleted } from "@/lib/cards/realtime";
import { db } from "@/lib/db";
import { requireBoardMember } from "@/lib/permissions";
import { utapi } from "@/lib/uploadthing-server";

import { DeleteCardAttachment } from "./schema";
import { InputType, ReturnType } from "./types";

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId, orgId } = await auth();

  if (!userId || !orgId) {
    return {
      error: "Không có quyền truy cập.",
    };
  }

  const { id, cardId, boardId } = data;

  try {
    const permission = await requireBoardMember({ boardId, orgId, userId });

    if (permission.error) {
      return { error: permission.error };
    }

    const attachment = await db.cardAttachment.findFirst({
      where: {
        id,
        cardId,
        card: {
          list: {
            board: {
              id: boardId,
              orgId,
            },
          },
        },
      },
    });

    if (!attachment) {
      return {
        error: "Không tìm thấy đính kèm.",
      };
    }

    if (attachment.type === AttachmentType.FILE && !attachment.fileKey) {
      return {
        error: "Không thể xóa file vì thiếu mã file lưu trữ.",
      };
    }

    if (attachment.type === AttachmentType.FILE) {
      try {
        await utapi.deleteFiles(attachment.fileKey!);
      } catch (error) {
        console.error("[DELETE_CARD_ATTACHMENT_STORAGE_ERROR]", {
          error,
          attachmentId: attachment.id,
          fileKey: attachment.fileKey,
          cardId,
          boardId,
        });

        return {
          error: "Xóa file trong kho lưu trữ thất bại. Vui lòng thử lại.",
        };
      }
    }

    const deletedAttachment = await db.cardAttachment.delete({
      where: {
        id: attachment.id,
      },
    });

    await createAuditLog({
      entityId: cardId,
      entityType: ENTITY_TYPE.CARD,
      entityTitle: `detail:đã xóa đính kèm "${deletedAttachment.name}"`,
      action: ACTION.UPDATE,
      boardId,
      cardId,
    });

    await triggerAttachmentDeleted({
      boardId,
      cardId,
      actorUserId: userId,
      attachment: deletedAttachment,
    });

    revalidatePath(`/board/${boardId}`);
    return { data: deletedAttachment };
  } catch (error) {
    console.error("[DELETE_CARD_ATTACHMENT_ERROR]", error);
    return {
      error: "Xóa đính kèm thất bại.",
    };
  }
};

export const deleteCardAttachment = createSafeAction(DeleteCardAttachment, handler);
