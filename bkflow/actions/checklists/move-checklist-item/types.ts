import { ChecklistItem } from "@prisma/client";
import { z } from "zod";

import { ActionState } from "@/lib/create-safe-action";

import { MoveChecklistItem } from "./schema";

export type InputType = z.infer<typeof MoveChecklistItem>;
export type ReturnType = ActionState<InputType, ChecklistItem[]>;
