import { z } from "zod";

export const CreateAiChecklistItems = z.object({
  boardId: z.string(),
  cardId: z.string(),
  checklistId: z.string().optional(),
  checklistTitle: z.string().optional(),
  items: z.array(
    z.string()
      .transform((value) => value.replace(/\s+/g, " ").trim())
      .pipe(z.string().min(3, {
        message: "Mục checklist quá ngắn.",
      }).max(120, {
        message: "Mục checklist quá dài.",
      })),
  ).min(1, {
    message: "Vui lòng chọn ít nhất một mục checklist.",
  }).max(8, {
    message: "Chỉ có thể thêm tối đa 8 mục mỗi lần.",
  }),
});
