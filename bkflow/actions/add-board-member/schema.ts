import { z } from "zod";
import { BoardMemberRole } from "@prisma/client";

export const AddBoardMember = z.object({
  boardId: z.string(),
  memberUserId: z.string(),
  role: z.enum(BoardMemberRole).optional(),
});
