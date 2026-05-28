import { z } from "zod";

export const CreateCardAttachment = z.object({
  cardId: z.string().min(1),
  boardId: z.string().min(1),
  url: z
    .string()
    .trim()
    .min(1, {
      message: "Vui lòng nhập liên kết.",
    })
    .url({
      message: "Liên kết không hợp lệ.",
    }),
  name: z.optional(z.string().trim()),
});
