import { z } from "zod";

export const CreateChecklist = z.object({
  title: z.string().min(1, {
    message: "Tiêu đề không được để trống",
  }),
  boardId: z.string(),
  cardId: z.string(),
  copyFromChecklistId: z.string().optional(),
});
