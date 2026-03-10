"use server";

import { auth } from "@clerk/nextjs/server";
import { ACTION, AUDIT_EVENT_TYPE, ENTITY_TYPE } from "@prisma/client";

import { createAuditLog } from "@/lib/create-audit-log";
import { db } from "@/lib/db";
import { createSafeAction } from "@/lib/create-safe-action";
import { requireBoardMember } from "@/lib/permissions";
import {
  triggerCardLabelAttached,
  triggerCardLabelDetached,
} from "@/lib/boards/realtime";

import { ToggleCardLabel } from "./schema";
import { InputType, ReturnType } from "./types";

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId, orgId } = await auth();

  if (!userId || !orgId) {
    return {
      error: "Không có quyền truy cập.",
    };
  }

  const { cardId, labelId, boardId } = data;

  try {
    const permission = await requireBoardMember({ boardId, orgId, userId });

    if (permission.error) {
      return { error: permission.error };
    }

    const card = await db.card.findFirst({
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
        list: {
          select: {
            boardId: true,
          },
        },
      },
    });

    if (!card) {
      return { error: "KhÃ´ng tÃ¬m tháº¥y tháº»." };
    }

    const label = await db.label.findFirst({
      where: {
        id: labelId,
        boardId: card.list.boardId,
        board: {
          orgId,
        },
      },
    });

    if (!label) {
      return { error: "KhÃ´ng tÃ¬m tháº¥y nhÃ£n." };
    }

    const existingCardLabel = await db.cardLabel.findUnique({
      where: {
        cardId_labelId: {
          cardId: card.id,
          labelId: label.id,
        },
      },
    });

    let toggled = false;

    if (existingCardLabel) {
      await db.cardLabel.delete({
        where: {
          cardId_labelId: {
            cardId: card.id,
            labelId: label.id,
          },
        },
      });
      toggled = false;
    } else {
      await db.cardLabel.create({
        data: {
          cardId: card.id,
          labelId: label.id,
        },
      });
      toggled = true;
    }

    const triggerCardLabel = toggled
      ? triggerCardLabelAttached
      : triggerCardLabelDetached;

    await createAuditLog({
      entityId: card.id,
      entityTitle: toggled
        ? `detail:đã gắn nhãn "${label.title || label.color}" vào thẻ "${card.title}"`
        : `detail:đã bỏ nhãn "${label.title || label.color}" khỏi thẻ "${card.title}"`,
      entityType: ENTITY_TYPE.CARD,
      action: ACTION.UPDATE,
      eventType: AUDIT_EVENT_TYPE.LABEL,
      boardId: card.list.boardId,
      cardId: card.id,
    });

    await triggerCardLabel({
      boardId: card.list.boardId,
      cardId: card.id,
      labelId: label.id,
      actorUserId: userId,
      labelName: label.title,
      labelColor: label.color,
    });

    return {
      data: {
        cardId: card.id,
        labelId: label.id,
        toggled,
      },
    };
  } catch {
    return {
      error: "Gắn nhãn thất bại.",
    };
  }
};

export const toggleCardLabel = createSafeAction(ToggleCardLabel, handler);
