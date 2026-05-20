import { z } from "zod";

export const ToggleChecklistItem = z.object({
  boardId: z.string(),
  cardId: z.string(),
  id: z.string(),
  isCompleted: z.boolean(),
});
