import { z } from "zod";

import { ActionState } from "@/lib/create-safe-action";

import { GenerateAiChecklist } from "./schema";

export type InputType = z.infer<typeof GenerateAiChecklist>;
export type ReturnType = ActionState<InputType, {
  items: string[];
}>;
