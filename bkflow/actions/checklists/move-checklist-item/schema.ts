import { z } from "zod";

const orderedItem = z.object({
  id: z.string(),
  order: z.number().int().nonnegative(),
});

export const MoveChecklistItem = z.object({
  boardId: z.string(),
  cardId: z.string(),
  itemId: z.string(),
  sourceChecklistId: z.string(),
  destinationChecklistId: z.string(),
  sourceItems: z.array(orderedItem),
  destinationItems: z.array(orderedItem),
});
