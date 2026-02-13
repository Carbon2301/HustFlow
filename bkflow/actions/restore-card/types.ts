import { z } from "zod";
import { Prisma } from "@prisma/client";

import { ActionState } from "@/lib/create-safe-action";

import { RestoreCard } from "./schema";

export type InputType = z.infer<typeof RestoreCard>;
export type ReturnType = ActionState<InputType, Prisma.CardGetPayload<{
  include: {
    list: {
      select: {
        archivedAt: true;
        title: true;
      };
    };
  };
}>>;
