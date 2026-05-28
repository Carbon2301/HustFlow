import { z } from "zod";
import { CardAttachment } from "@prisma/client";

import { ActionState } from "@/lib/create-safe-action";

import { UpdateCardAttachmentOrder } from "./schema";

export type InputType = z.infer<typeof UpdateCardAttachmentOrder>;
export type ReturnType = ActionState<InputType, CardAttachment[]>;
