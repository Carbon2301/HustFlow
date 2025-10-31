import { z } from "zod";

export const DeleteCardAttachment = z.object({
  id: z.string().min(1),
  cardId: z.string().min(1),
  boardId: z.string().min(1),
});
