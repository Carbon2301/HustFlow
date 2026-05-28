import { z } from "zod";

export const ToggleCardCommentReaction = z.object({
  boardId: z.string(),
  cardId: z.string(),
  commentId: z.string(),
  emoji: z.enum(["👍", "❤️", "😂", "🎉"]),
});
