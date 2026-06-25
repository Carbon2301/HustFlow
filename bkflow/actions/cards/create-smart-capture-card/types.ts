import { z } from "zod";

import { ActionState } from "@/lib/create-safe-action";
import type { CardWithAssignees } from "@/types";

import { CreateSmartCaptureCards } from "./schema";

export type InputType = z.infer<typeof CreateSmartCaptureCards>;
export type ReturnType = ActionState<InputType, CardWithAssignees[]>;
