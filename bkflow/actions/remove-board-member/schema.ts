import { z } from "zod";

export const RemoveBoardMember = z.object({
  boardId: z.string(),
  boardMemberId: z.string(),
});
