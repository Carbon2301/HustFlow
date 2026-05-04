"use server";

import { auth } from "@clerk/nextjs/server";

import { updateCardService } from "@/lib/cards/card-update-service";
import { createSafeAction } from "@/lib/create-safe-action";

import { UpdateCard } from "./schema";
import { InputType, ReturnType } from "./types";

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId, orgId } = await auth();

  if (!userId || !orgId) {
    return {
      error: "Không có quyền truy cập.",
    };
  }

  return updateCardService({ data, userId, orgId });
};

export const updateCard = createSafeAction(UpdateCard, handler);
