import { BoardMemberRole } from "@prisma/client";
import { z } from "zod";

export const UpdateBoardMemberRole = z.object({
  boardId: z.string(),
  boardMemberId: z.string(),
  role: z.enum(BoardMemberRole),
});
