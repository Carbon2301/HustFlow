import { z } from "zod";

import { ActionState } from "@/lib/create-safe-action";

import { GenerateAiCardQuality } from "./schema";

export type InputType = z.infer<typeof GenerateAiCardQuality>;
export type ReturnType = ActionState<InputType, {
  task: InputType["task"];
  description?: string;
  labelIds?: string[];
  reason?: string;
}>;
