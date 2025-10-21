import { z } from "zod";
import { Prisma } from "@prisma/client";

import { ActionState } from "@/lib/create-safe-action";
import { AssignChecklistItem } from "./schema";

export type InputType = z.infer<typeof AssignChecklistItem>;
export type ReturnType = ActionState<
  InputType,
  Prisma.ChecklistItemGetPayload<{ include: { assignee: true } }>
>;
