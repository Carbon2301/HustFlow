import { z } from "zod";
import { BoardMember } from "@prisma/client";

import { ActionState } from "@/lib/create-safe-action";

import { RemoveBoardMember } from "./schema";

export type InputType = z.infer<typeof RemoveBoardMember>;
export type ReturnType = ActionState<InputType, BoardMember>;
