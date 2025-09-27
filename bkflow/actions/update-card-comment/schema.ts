import { z } from "zod";

export const UpdateCardComment = z.object({
  boardId: z.string(),
  cardId: z.string(),
  commentId: z.string(),
  content: z.string().trim().min(1, {
    message: "Vui lòng nhập nội dung bình luận.",
  }),
});
