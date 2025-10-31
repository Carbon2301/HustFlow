import { AttachmentType } from "@prisma/client";
import { z } from "zod";

export const UpdateCardAttachmentOrder = z.object({
  boardId: z.string().min(1),
  cardId: z.string().min(1),
  type: z.nativeEnum(AttachmentType),
  items: z.array(
    z.object({
      id: z.string().min(1),
      order: z.number().int().nonnegative(),
    }),
  ).min(1),
});
