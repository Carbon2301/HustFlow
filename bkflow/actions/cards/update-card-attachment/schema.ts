import { z } from "zod";

export const UpdateCardAttachment = z.object({
  id: z.string().min(1),
  cardId: z.string().min(1),
  boardId: z.string().min(1),
  name: z.optional(z.string().trim()),
  url: z.optional(z.string().trim()),
});
