import { z } from "zod";

export const CreateCardComment = z.object({
  boardId: z.string(),
  cardId: z.string(),
  content: z.string().trim().min(1, {
    message: "Vui lòng nhập nội dung bình luận.",
  }),
  parentId: z.optional(z.union([z.string(), z.null()])),
});
