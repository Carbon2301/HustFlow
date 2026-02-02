import { z } from "zod";

export const CreateBoard = z.object({
  title: z.string("Vui lòng nhập tiêu đề").min(1, {
    message: "Tiêu đề quá ngắn (tối thiểu 1 ký tự)."
  }),
  image: z.string("Vui lòng chọn ảnh nền"),
});
