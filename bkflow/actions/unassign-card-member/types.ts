import { z } from "zod";
import { Prisma } from "@prisma/client";

import { ActionState } from "@/lib/create-safe-action";

import { UnassignCardMember } from "./schema";

export type InputType = z.infer<typeof UnassignCardMember>;
export type ReturnType = ActionState<
  InputType,
  Prisma.CardAssigneeGetPayload<{ include: { boardMember: true; card: true } }>
>;
