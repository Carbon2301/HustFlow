import { z } from "zod";

export const ArchiveCard = z.object({
  id: z.string(),
  boardId: z.string(),
});
