import { Checklist, ChecklistItem } from "@prisma/client";
import { z } from "zod";

import { ActionState } from "@/lib/create-safe-action";

import { CreateAiChecklistItems } from "./schema";

export type InputType = z.infer<typeof CreateAiChecklistItems>;
export type ReturnType = ActionState<InputType, {
  checklist: Checklist;
  items: ChecklistItem[];
}>;
