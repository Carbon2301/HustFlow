import { z } from "zod";
import { Prisma } from "@prisma/client";

import { ActionState } from "@/lib/create-safe-action";

import { ArchiveCard } from "./schema";

export type InputType = z.infer<typeof ArchiveCard>;
export type ReturnType = ActionState<InputType, Prisma.CardGetPayload<{
  include: {
    list: {
      select: {
        title: true;
      };
    };
  };
}>>;
