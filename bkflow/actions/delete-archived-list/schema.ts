import { z } from "zod";

export const DeleteArchivedList = z.object({
  id: z.string(),
  boardId: z.string(),
});
