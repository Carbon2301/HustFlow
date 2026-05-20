import { z } from "zod";

export const CreateCard = z.object({
  title: z.string("Vui lòng nhập tiêu đề").min(1, {
    message: "Tiêu đề quá ngắn (tối thiểu 1 ký tự)",
  }),
  boardId: z.string(),
  listId: z.string(),
  startDate: z.optional(z.union([z.date(), z.null()])),
  dueDate: z.optional(z.union([z.date(), z.null()])),
});
