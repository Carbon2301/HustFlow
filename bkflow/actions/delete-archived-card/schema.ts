import { z } from "zod";

export const DeleteArchivedCard = z.object({
  id: z.string(),
  boardId: z.string(),
});
