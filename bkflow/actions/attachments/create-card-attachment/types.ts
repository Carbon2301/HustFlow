import { z } from "zod";
import { CardAttachment } from "@prisma/client";

import { ActionState } from "@/lib/create-safe-action";

import { CreateCardAttachment } from "./schema";

export type InputType = z.infer<typeof CreateCardAttachment>;
export type ReturnType = ActionState<InputType, CardAttachment>;
