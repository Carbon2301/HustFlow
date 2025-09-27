import { z } from "zod";
import { CardComment } from "@prisma/client";

import { ActionState } from "@/lib/create-safe-action";

import { UpdateCardComment } from "./schema";

export type InputType = z.infer<typeof UpdateCardComment>;
export type ReturnType = ActionState<InputType, CardComment>;
