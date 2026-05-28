import { z } from "zod";
import { CardAttachment } from "@prisma/client";

import { ActionState } from "@/lib/create-safe-action";

import { CreateCardFileAttachments } from "./schema";

export type InputType = z.infer<typeof CreateCardFileAttachments>;
export type ReturnType = ActionState<InputType, CardAttachment[]>;
