import { z } from "zod";

export const UpdateCard = z.object({
  boardId: z.string(),
  description: z.optional(z.string()),
  descriptionBaseUpdatedAt: z.optional(z.string().datetime()),
  title: z.optional(
    z.string("Vui lòng nhập tiêu đề").min(1, {
      message: "Tiêu đề quá ngắn (tối thiểu 1 ký tự)",
    }),
  ),
  startDate: z.optional(z.union([z.date(), z.null()])),
  dueDate: z.optional(z.union([z.date(), z.null()])),
  dueDateTimezoneOffset: z.optional(z.number()),
  isCompleted: z.optional(z.boolean()),
  reminder: z.optional(z.union([z.string(), z.null()])),
  id: z.string(),
}).superRefine((data, ctx) => {
  if (data.description !== undefined && !data.descriptionBaseUpdatedAt) {
    ctx.addIssue({
      code: "custom",
      path: ["descriptionBaseUpdatedAt"],
      message: "Thiếu mốc cập nhật mô tả.",
    });
  }
});
