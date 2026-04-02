import { z } from "zod";

export const DeleteCardDependency = z.object({
  boardId: z.string().min(1),
  dependencyId: z.string().min(1),
});
