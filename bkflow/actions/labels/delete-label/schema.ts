import { z } from "zod";

export const DeleteLabel = z.object({
  boardId: z.string(),
  labelId: z.string(),
});
