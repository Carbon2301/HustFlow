import { z } from "zod";

export const CreateCardDependency = z.object({
  boardId: z.string().min(1),
  blockerCardId: z.string().min(1),
  blockedCardId: z.string().min(1),
});
