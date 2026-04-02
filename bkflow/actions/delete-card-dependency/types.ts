import { z } from "zod";
import { CardDependency } from "@prisma/client";

import { ActionState } from "@/lib/create-safe-action";

import { DeleteCardDependency } from "./schema";

export type InputType = z.infer<typeof DeleteCardDependency>;
export type ReturnType = ActionState<InputType, CardDependency>;
