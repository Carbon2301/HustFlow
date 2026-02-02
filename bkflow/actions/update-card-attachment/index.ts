"use server";

import { auth } from "@clerk/nextjs/server";
import { ACTION, AttachmentType, ENTITY_TYPE } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { createAuditLog } from "@/lib/create-audit-log";
import { createSafeAction } from "@/lib/create-safe-action";
import { triggerAttachmentUpdated } from "@/lib/cards/realtime";
import { db } from "@/lib/db";
import { requireBoardMember } from "@/lib/permissions";

import { UpdateCardAttachment } from "./schema";
import { InputType, ReturnType } from "./types";

const isValidUrl = (value: string) => {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
};

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId, orgId } = await auth();

  if (!userId || !orgId) {
    return {
      error: "Không có quyền truy cập.",
    };
  }

  const { id, cardId, boardId } = data;
  const name = data.name?.trim() ?? "";
  const url = data.url?.trim();

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

    const nextUrl = url ?? attachment.url;

    if (attachment.type === AttachmentType.LINK && !nextUrl) {
      return {
        error: "Vui lòng nhập liên kết.",
      };
    }

    if (attachment.type === AttachmentType.LINK && !isValidUrl(nextUrl)) {
      return {
        error: "Liên kết không hợp lệ.",
      };
    }

    if (
      attachment.type === AttachmentType.FILE &&
      url &&
      url !== attachment.url
    ) {
      return {
        error: "Không thể thay đổi URL của file đính kèm.",
      };
    }

    const updatedAttachment =
      attachment.type === AttachmentType.LINK
        ? await updateLinkAttachment({
            id: attachment.id,
            name,
            url: nextUrl,
          })
        : await updateFileAttachment({
            id: attachment.id,
            name,
            currentName: attachment.name,
          });

    await createAuditLog({
      entityId: cardId,
      entityType: ENTITY_TYPE.CARD,
      entityTitle: `detail:đã cập nhật đính kèm "${updatedAttachment.name}"`,
      action: ACTION.UPDATE,
      boardId,
      cardId,
    });

    await triggerAttachmentUpdated({
      boardId,
      cardId,
      actorUserId: userId,
      attachment: updatedAttachment,
    });

    revalidatePath(`/board/${boardId}`);
    return { data: updatedAttachment };
  } catch (error) {
    console.error("[UPDATE_CARD_ATTACHMENT_ERROR]", error);
    return {
      error: "Cập nhật đính kèm thất bại.",
    };
  }
};

type UpdateLinkAttachmentInput = {
  id: string;
  name: string;
  url: string;
};

const updateLinkAttachment = async ({
  id,
  name,
  url,
}: UpdateLinkAttachmentInput) => {
  return db.cardAttachment.update({
    where: {
      id,
    },
    data: {
      name: name || url,
      url,
    },
  });
};

type UpdateFileAttachmentInput = {
  id: string;
  name: string;
  currentName: string;
};

const updateFileAttachment = async ({
  id,
  name,
  currentName,
}: UpdateFileAttachmentInput) => {
  return db.cardAttachment.update({
    where: {
      id,
    },
    data: {
      name: name || currentName,
    },
  });
};

export const updateCardAttachment = createSafeAction(UpdateCardAttachment, handler);
