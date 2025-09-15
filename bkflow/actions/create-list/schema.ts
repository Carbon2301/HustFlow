import { z } from "zod";

export const CreateList = z.object({
  title: z.string("Vui lòng nhập tiêu đề").min(3, {
    message: "Tiêu đề quá ngắn (tối thiểu 3 ký tự)",
  }),
  boardId: z.string(),
});
