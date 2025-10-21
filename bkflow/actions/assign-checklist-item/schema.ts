import { z } from "zod";

export const AssignChecklistItem = z.object({
  boardId: z.string(),
  cardId: z.string(),
  id: z.string(),
  assigneeId: z.union([z.string(), z.null()]),
});
