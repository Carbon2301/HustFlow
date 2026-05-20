import { z } from "zod";
import { ChecklistItem } from "@prisma/client";

import { ActionState } from "@/lib/create-safe-action";
import { ReorderChecklistItems } from "./schema";

export type InputType = z.infer<typeof ReorderChecklistItems>;
export type ReturnType = ActionState<InputType, ChecklistItem[]>;
