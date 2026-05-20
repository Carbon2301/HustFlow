import { z } from "zod";
import { CardComment } from "@prisma/client";

import { ActionState } from "@/lib/create-safe-action";

import { CreateCardComment } from "./schema";

export type InputType = z.infer<typeof CreateCardComment>;
export type ReturnType = ActionState<InputType, CardComment>;
