import { z } from "zod";

export const ArchiveList = z.object({
  id: z.string(),
  boardId: z.string(),
});
