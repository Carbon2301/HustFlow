import { z } from "zod";
import { CardAttachment } from "@prisma/client";

import { ActionState } from "@/lib/create-safe-action";

import { UpdateCardAttachment } from "./schema";

export type InputType = z.infer<typeof UpdateCardAttachment>;
export type ReturnType = ActionState<InputType, CardAttachment>;
