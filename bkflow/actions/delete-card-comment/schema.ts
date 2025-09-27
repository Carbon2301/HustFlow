import { z } from "zod";

export const DeleteCardComment = z.object({
  boardId: z.string(),
  cardId: z.string(),
  commentId: z.string(),
});
