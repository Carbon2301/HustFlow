"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { createSafeAction } from "@/lib/create-safe-action";
import { requireBoardMember } from "@/lib/permissions";
import { triggerLabelDeleted } from "@/lib/boards/realtime";

import { DeleteLabel } from "./schema";
import { InputType, ReturnType } from "./types";

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId, orgId } = await auth();

  if (!userId || !orgId) {
    return {
      error: "Không có quyền truy cập.",
    };
  }

  const { boardId, labelId } = data;

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

    const label = await db.label.delete({
      where: {
        id: existingLabel.id,
      },
    });

    await triggerLabelDeleted({
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
      error: "Xóa nhãn thất bại.",
    };
  }
};

export const deleteLabel = createSafeAction(DeleteLabel, handler);
