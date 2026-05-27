import { z } from "zod";

import { ActionState } from "@/lib/create-safe-action";
import type { CardWithAssignees } from "@/types";

import { CreateSmartCaptureCard } from "./schema";

export type InputType = z.infer<typeof CreateSmartCaptureCard>;
export type ReturnType = ActionState<InputType, CardWithAssignees>;
