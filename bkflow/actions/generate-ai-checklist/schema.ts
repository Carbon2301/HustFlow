import { z } from "zod";

export const GenerateAiChecklist = z.object({
  boardId: z.string(),
  cardId: z.string(),
});
