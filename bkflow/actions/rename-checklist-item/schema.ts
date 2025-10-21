import { z } from "zod";

export const RenameChecklistItem = z.object({
  boardId: z.string(),
  cardId: z.string(),
  id: z.string(),
  title: z.string().min(1, {
    message: "Noi dung khong duoc de trong",
  }),
});
