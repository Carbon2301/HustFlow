import { z } from "zod";

export const ArchiveListCards = z.object({
  id: z.string(),
  boardId: z.string(),
});
