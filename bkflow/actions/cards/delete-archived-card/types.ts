import { z } from "zod";
import { Prisma } from "@prisma/client";

import { ActionState } from "@/lib/create-safe-action";

import { DeleteArchivedCard } from "./schema";

export type InputType = z.infer<typeof DeleteArchivedCard>;
export type ReturnType = ActionState<InputType, Prisma.CardGetPayload<{
  include: {
    list: {
      select: {
        title: true;
      };
    };
  };
}>>;
