import { z } from "zod";

export const UnassignCardMember = z.object({
  boardId: z.string(),
  cardId: z.string(),
  boardMemberId: z.string(),
});
