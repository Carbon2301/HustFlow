"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { createSafeAction } from "@/lib/create-safe-action";
import { requireBoardMember } from "@/lib/permissions";

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

    const label = await db.label.update({
      where: {
        id: labelId,
        boardId,
      },
      data: {
        title,
        color,
      },
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
