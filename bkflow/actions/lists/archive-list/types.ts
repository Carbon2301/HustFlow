import { z } from "zod";
import { List } from "@prisma/client";

import { ActionState } from "@/lib/create-safe-action";

import { ArchiveList } from "./schema";

export type InputType = z.infer<typeof ArchiveList>;
export type ReturnType = ActionState<InputType, List>;
