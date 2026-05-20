"use server";

import { auth, currentUser } from "@clerk/nextjs/server";

import { copyCardService } from "@/lib/cards/copy-card-service";
import { createSafeAction } from "@/lib/create-safe-action";

import { CopyCard } from "./schema";
import { InputType, ReturnType } from "./types";

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId } = await auth();
  const user = await currentUser();

  if (!userId || !user) {
    return {
      error: "Không có quyền truy cập.",
    };
  }

  return copyCardService({ data, userId, user });
};

export const copyCard = createSafeAction(CopyCard, handler);
