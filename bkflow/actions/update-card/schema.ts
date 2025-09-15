import { z } from "zod";

export const UpdateCard = z.object({
  boardId: z.string(),
  description: z.optional(
    z.string("Vui lòng nhập mô tả").min(3, {
      message: "Mô tả quá ngắn (tối thiểu 3 ký tự).",
    }),
  ),
  title: z.optional(
    z.string("Vui lòng nhập tiêu đề").min(3, {
      message: "Tiêu đề quá ngắn (tối thiểu 3 ký tự)",
    })
  ),
  id: z.string(),
});
