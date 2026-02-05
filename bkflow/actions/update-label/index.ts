"use server";

import { auth } from "@clerk/nextjs/server";
import { ACTION, AUDIT_EVENT_TYPE, ENTITY_TYPE } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { createAuditLog } from "@/lib/create-audit-log";
import { db } from "@/lib/db";
import { createSafeAction } from "@/lib/create-safe-action";
import { requireBoardMember } from "@/lib/permissions";
import { triggerLabelUpdated } from "@/lib/boards/realtime";

import { UpdateLabel } from "./schema";
import { InputType, ReturnType } from "./types";

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId, orgId } = await auth();

  if (!userId || !orgId) {
    return {
      error: "Không có quyền truy cập.",
    };
  }

  const { boardId, labelId, title, color } = data;

  try {
    const permission = await requireBoardMember({ boardId, orgId, userId });

    if (permission.error) {
      return { error: permission.error };
    }

    const existingLabel = await db.label.findFirst({
      where: {
        id: labelId,
        boardId,
        board: {
          orgId,
        },
      },
    });

    if (!existingLabel) {
      return { error: "KhÃ´ng tÃ¬m tháº¥y nhÃ£n." };
    }

    const label = await db.label.update({
      where: {
        id: existingLabel.id,
      },
      data: {
        title,
        color,
      },
    });

    await createAuditLog({
      entityId: boardId,
      entityTitle: `detail:đã cập nhật nhãn "${label.title || label.color}"`,
      entityType: ENTITY_TYPE.BOARD,
      action: ACTION.UPDATE,
      eventType: AUDIT_EVENT_TYPE.LABEL,
      boardId: label.boardId,
    });

    await triggerLabelUpdated({
      boardId: label.boardId,
      labelId: label.id,
      actorUserId: userId,
      labelName: label.title,
      labelColor: label.color,
    });

    revalidatePath(`/board/${boardId}`);
    return { data: label };
  } catch {
    return {
      error: "Cập nhật nhãn thất bại.",
    };
  }
};

export const updateLabel = createSafeAction(UpdateLabel, handler);
