import { z } from "zod";
import { BoardMember } from "@prisma/client";

import { ActionState } from "@/lib/create-safe-action";

import { LeaveBoard } from "./schema";

export type InputType = z.infer<typeof LeaveBoard>;
export type ReturnType = ActionState<InputType, BoardMember>;
