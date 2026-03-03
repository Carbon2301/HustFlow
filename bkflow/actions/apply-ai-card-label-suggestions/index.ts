"use server";

import { auth } from "@clerk/nextjs/server";
import { ACTION, AUDIT_EVENT_TYPE, ENTITY_TYPE } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { createAuditLog } from "@/lib/create-audit-log";
import { createSafeAction } from "@/lib/create-safe-action";
import { db } from "@/lib/db";
import { requireBoardMember } from "@/lib/permissions";
import { triggerCardLabelAttached } from "@/lib/boards/realtime";

import { ApplyAiCardLabelSuggestions } from "./schema";
import { InputType, ReturnType } from "./types";

const uniqueIds = (ids: string[]) => Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId, orgId } = await auth();

  if (!userId || !orgId) {
    return { error: "Không có quyền truy cập." };
  }

  const { boardId, cardId } = data;
  const labelIds = uniqueIds(data.labelIds).slice(0, 3);

  if (labelIds.length === 0) {
    return { error: "Vui lòng chọn ít nhất một nhãn." };
  }

  try {
    const permission = await requireBoardMember({ boardId, orgId, userId });

    if (permission.error) {
      return { error: permission.error };
    }

    const card = await db.card.findFirst({
      where: {
        id: cardId,
        archivedAt: null,
        list: {
          archivedAt: null,
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
      return { error: "Không tìm thấy thẻ." };
    }

    const labels = await db.label.findMany({
      where: {
        id: {
          in: labelIds,
        },
        boardId,
        board: {
          orgId,
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    if (labels.length === 0) {
      return { error: "Không tìm thấy nhãn hợp lệ để gắn." };
    }

    const validLabelIds = labels.map((label) => label.id);
    const existingCardLabels = await db.cardLabel.findMany({
      where: {
        cardId,
        labelId: {
          in: validLabelIds,
        },
      },
      select: {
        labelId: true,
      },
    });
    const existingLabelIds = new Set(existingCardLabels.map((item) => item.labelId));
    const labelsToAttach = labels.filter((label) => !existingLabelIds.has(label.id));

    if (labelsToAttach.length === 0) {
      return { error: "Các nhãn AI gợi ý đã được gắn vào thẻ." };
    }

    await db.cardLabel.createMany({
      data: labelsToAttach.map((label) => ({
        cardId,
        labelId: label.id,
      })),
      skipDuplicates: true,
    });

    await createAuditLog({
      entityId: card.id,
      entityTitle: `detail:đã gắn ${labelsToAttach.length} nhãn AI gợi ý vào thẻ "${card.title}"`,
      entityType: ENTITY_TYPE.CARD,
      action: ACTION.UPDATE,
      eventType: AUDIT_EVENT_TYPE.LABEL,
      boardId,
      cardId: card.id,
    });

    await Promise.all(labelsToAttach.map((label) =>
      triggerCardLabelAttached({
        boardId,
        cardId: card.id,
        labelId: label.id,
        actorUserId: userId,
        labelName: label.title,
        labelColor: label.color,
      }),
    ));

    revalidatePath(`/board/${boardId}`);

    return {
      data: {
        cardId: card.id,
        labels: labelsToAttach,
      },
    };
  } catch (error) {
    console.error("[APPLY_AI_CARD_LABEL_SUGGESTIONS_ERROR]", error);

    return {
      error: "Gắn nhãn AI gợi ý thất bại.",
    };
  }
};

export const applyAiCardLabelSuggestions = createSafeAction(
  ApplyAiCardLabelSuggestions,
  handler,
);
