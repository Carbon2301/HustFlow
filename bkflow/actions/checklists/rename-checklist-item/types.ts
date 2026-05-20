import { z } from "zod";
import { ChecklistItem } from "@prisma/client";

import { ActionState } from "@/lib/create-safe-action";
import { RenameChecklistItem } from "./schema";

export type InputType = z.infer<typeof RenameChecklistItem>;
export type ReturnType = ActionState<InputType, ChecklistItem>;
