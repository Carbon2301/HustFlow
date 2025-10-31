import { z } from "zod";
import { CardAttachment } from "@prisma/client";

import { ActionState } from "@/lib/create-safe-action";

import { DeleteCardAttachment } from "./schema";

export type InputType = z.infer<typeof DeleteCardAttachment>;
export type ReturnType = ActionState<InputType, CardAttachment>;
