import { z } from "zod";

export const CreateLabel = z.object({
  boardId: z.string(),
  cardId: z.string(),
  title: z.string().max(100, {
    message: "Tiêu đề quá dài (tối đa 100 ký tự)."
  }),
  color: z.string().min(1, {
    message: "Vui lòng chọn màu sắc."
  }),
});
