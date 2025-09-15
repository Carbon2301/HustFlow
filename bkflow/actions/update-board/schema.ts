import { z } from "zod";

export const UpdateBoard = z.object({
  title: z.string("Vui lòng nhập tiêu đề").min(3, {
    message: "Tiêu đề quá ngắn (tối thiểu 3 ký tự)",
  }),
  id: z.string(),
});
