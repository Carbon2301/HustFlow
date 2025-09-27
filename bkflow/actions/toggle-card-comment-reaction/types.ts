import { z } from "zod";
import { CardCommentReaction } from "@prisma/client";

import { ActionState } from "@/lib/create-safe-action";

import { ToggleCardCommentReaction } from "./schema";

export type InputType = z.infer<typeof ToggleCardCommentReaction>;
export type ReturnType = ActionState<InputType, CardCommentReaction>;
