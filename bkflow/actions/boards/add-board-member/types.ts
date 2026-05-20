import { z } from "zod";
import { BoardMember } from "@prisma/client";

import { ActionState } from "@/lib/create-safe-action";

import { AddBoardMember } from "./schema";

export type InputType = z.infer<typeof AddBoardMember>;
export type ReturnType = ActionState<InputType, BoardMember>;
