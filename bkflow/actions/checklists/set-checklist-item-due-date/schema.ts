import { z } from "zod";

export const SetChecklistItemDueDate = z.object({
  boardId: z.string(),
  cardId: z.string(),
  id: z.string(),
  dueDate: z.union([z.date(), z.null()]),
});
