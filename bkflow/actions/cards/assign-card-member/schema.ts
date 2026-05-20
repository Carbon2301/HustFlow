import { z } from "zod";

export const AssignCardMember = z.object({
  boardId: z.string(),
  cardId: z.string(),
  boardMemberId: z.string(),
});
