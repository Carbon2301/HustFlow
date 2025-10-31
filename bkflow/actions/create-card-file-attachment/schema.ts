import { z } from "zod";

export const CreateCardFileAttachment = z.object({
  cardId: z.string().min(1),
  boardId: z.string().min(1),
  name: z.string().trim().min(1),
  url: z.string().trim().url(),
  fileKey: z.string().trim().min(1),
  fileSize: z.number().int().nonnegative(),
  mimeType: z.string().trim().optional(),
});
