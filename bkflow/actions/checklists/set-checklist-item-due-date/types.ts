import { z } from "zod";
import { ChecklistItem } from "@prisma/client";

import { ActionState } from "@/lib/create-safe-action";
import { SetChecklistItemDueDate } from "./schema";

export type InputType = z.infer<typeof SetChecklistItemDueDate>;
export type ReturnType = ActionState<InputType, ChecklistItem>;
