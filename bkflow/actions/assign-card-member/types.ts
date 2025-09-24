import { z } from "zod";
import { Prisma } from "@prisma/client";

import { ActionState } from "@/lib/create-safe-action";

import { AssignCardMember } from "./schema";

export type InputType = z.infer<typeof AssignCardMember>;
export type ReturnType = ActionState<
  InputType,
  Prisma.CardAssigneeGetPayload<{ include: { boardMember: true } }>
>;
