import { z } from "zod";

export const AddBoardMember = z.object({
  boardId: z.string(),
  memberUserId: z.string(),
});
