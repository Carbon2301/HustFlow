import { Label } from "@prisma/client";
import { z } from "zod";

import { ActionState } from "@/lib/create-safe-action";

import { ApplyAiCardLabelSuggestions } from "./schema";

export type InputType = z.infer<typeof ApplyAiCardLabelSuggestions>;
export type ReturnType = ActionState<InputType, {
  cardId: string;
  labels: Label[];
}>;
