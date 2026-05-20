import { z } from "zod";

export const UpdateChecklist = z.object({
  boardId: z.string(),
  cardId: z.string(),
  id: z.string(),
  title: z.string().min(1, {
    message: "Tiêu đề không được để trống",
  }),
});
