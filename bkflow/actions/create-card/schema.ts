import { z } from "zod";

export const CreateCard = z.object({
  title: z.string("Vui lòng nhập tiêu đề").min(3, {
    message: "Tiêu đề quá ngắn (tối thiểu 3 ký tự)",
  }),
  boardId: z.string(),
  listId: z.string(),
  startDate: z.optional(z.union([z.date(), z.null()])),
  dueDate: z.optional(z.union([z.date(), z.null()])),
});
