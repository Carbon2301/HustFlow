import { z } from "zod";

export const ReorderChecklistItems = z.object({
  boardId: z.string(),
  cardId: z.string(),
  checklistId: z.string(),
  items: z.array(
    z.object({
      id: z.string(),
      order: z.number().int().nonnegative(),
    }),
  ),
});
