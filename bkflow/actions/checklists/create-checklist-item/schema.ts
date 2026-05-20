import { z } from "zod";

export const CreateChecklistItem = z.object({
  title: z.string().min(1, {
    message: "Nội dung không được để trống",
  }),
  boardId: z.string(),
  cardId: z.string(),
  checklistId: z.string(),
});
