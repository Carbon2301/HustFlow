"use server";

import { auth } from "@clerk/nextjs/server";
import { ACTION, AUDIT_EVENT_TYPE, ENTITY_TYPE } from "@prisma/client";

import { createAuditLog } from "@/lib/create-audit-log";
import { db } from "@/lib/db";
import { createSafeAction } from "@/lib/create-safe-action";
import { requireBoardMember } from "@/lib/permissions";
import { triggerLabelCreated } from "@/lib/boards/realtime";

import { CreateLabel } from "./schema";
import { InputType, ReturnType } from "./types";

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId, orgId } = await auth();

  if (!userId || !orgId) {
    return {
      error: "Không có quyền truy cập.",
    };
  }

  const { boardId, cardId, title, color } = data;

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
      return { error: "Không tìm thấy thẻ." };
    }

    const label = await db.label.create({
      data: {
        boardId: card.list.boardId,
        title,
        color,
        cards: {
          create: {
            cardId,
          },
        },
      },
    });

    await createAuditLog({
      entityId: card.id,
      entityTitle: `detail:đã tạo nhãn "${label.title || label.color}" và gắn vào thẻ "${card.title}"`,
      entityType: ENTITY_TYPE.CARD,
      action: ACTION.UPDATE,
      eventType: AUDIT_EVENT_TYPE.LABEL,
      boardId: card.list.boardId,
      cardId: card.id,
    });

    await triggerLabelCreated({
      boardId: card.list.boardId,
      cardId: card.id,
      labelId: label.id,
      actorUserId: userId,
      labelName: label.title,
      labelColor: label.color,
    });

    return { data: label };
  } catch {
    return {
      error: "Tạo nhãn thất bại.",
    };
  }
};

export const createLabel = createSafeAction(CreateLabel, handler);
