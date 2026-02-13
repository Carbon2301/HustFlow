import { z } from "zod";
import { List } from "@prisma/client";

import { ActionState } from "@/lib/create-safe-action";

import { DeleteArchivedList } from "./schema";

export type InputType = z.infer<typeof DeleteArchivedList>;
export type ReturnType = ActionState<InputType, List>;
