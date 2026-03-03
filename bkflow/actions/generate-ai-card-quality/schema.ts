import { z } from "zod";

export const AiCardQualityTask = z.enum([
  "create_description",
  "rewrite_description",
  "suggest_labels",
]);

export const GenerateAiCardQuality = z.object({
  boardId: z.string(),
  cardId: z.string(),
  task: AiCardQualityTask,
});
