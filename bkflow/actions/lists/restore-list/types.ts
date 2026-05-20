import { z } from "zod";
import { List } from "@prisma/client";

import { ActionState } from "@/lib/create-safe-action";

import { RestoreList } from "./schema";

export type InputType = z.infer<typeof RestoreList>;
export type ReturnType = ActionState<InputType, List>;
