import { z } from "zod";
import { ChecklistItem } from "@prisma/client";

import { ActionState } from "@/lib/create-safe-action";
import { ToggleChecklistItem } from "./schema";

export type InputType = z.infer<typeof ToggleChecklistItem>;
export type ReturnType = ActionState<InputType, ChecklistItem>;
