"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { createSafeAction } from "@/lib/create-safe-action";
import { requireBoardMember } from "@/lib/permissions";

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

    const existingCardLabel = await db.cardLabel.findUnique({
      where: {
        cardId_labelId: {
          cardId,
          labelId,
        },
      },
    });

    let toggled = false;

    if (existingCardLabel) {
      await db.cardLabel.delete({
        where: {
          cardId_labelId: {
            cardId,
            labelId,
          },
        },
      });
      toggled = false;
    } else {
      await db.cardLabel.create({
        data: {
          cardId,
          labelId,
        },
      });
      toggled = true;
    }

    revalidatePath(`/board/${boardId}`);
    return {
      data: {
        cardId,
        labelId,
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
