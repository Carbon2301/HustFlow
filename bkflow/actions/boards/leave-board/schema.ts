import { z } from "zod";

export const LeaveBoard = z.object({
  boardId: z.string(),
});
