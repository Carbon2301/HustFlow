import { BoardMember } from "@prisma/client";
import { z } from "zod";

import { ActionState } from "@/lib/create-safe-action";

import { UpdateBoardMemberRole } from "./schema";

export type InputType = z.infer<typeof UpdateBoardMemberRole>;
export type ReturnType = ActionState<InputType, BoardMember>;
