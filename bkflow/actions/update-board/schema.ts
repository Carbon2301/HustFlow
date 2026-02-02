import { z } from "zod";

export const UpdateBoard = z.object({
  title: z.string("Vui lòng nhập tiêu đề").min(1, {
    message: "Tiêu đề quá ngắn (tối thiểu 1 ký tự)",
  }),
  id: z.string(),
});
