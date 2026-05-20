import { z } from "zod";
import { CardComment } from "@prisma/client";

import { ActionState } from "@/lib/create-safe-action";

import { DeleteCardComment } from "./schema";

export type InputType = z.infer<typeof DeleteCardComment>;
export type ReturnType = ActionState<InputType, CardComment>;
