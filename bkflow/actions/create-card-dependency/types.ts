import { z } from "zod";
import { CardDependency } from "@prisma/client";

import { ActionState } from "@/lib/create-safe-action";

import { CreateCardDependency } from "./schema";

export type InputType = z.infer<typeof CreateCardDependency>;
export type ReturnType = ActionState<InputType, CardDependency>;
