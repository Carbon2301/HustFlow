import type { Card } from "@prisma/client";
import { z } from "zod";

import type { ActionState } from "@/lib/create-safe-action";

export const CopyCard = z.object({
  id: z.string(),
  sourceBoardId: z.string(),
  targetBoardId: z.string(),
  targetListId: z.string(),
  title: z.string("Vui lòng nhập tên thẻ").trim().min(1, {
    message: "Tên thẻ quá ngắn (tối thiểu 1 ký tự)",
  }),
  position: z.number().int().min(1),
  keepChecklists: z.boolean(),
  keepLabels: z.boolean(),
  keepMembers: z.boolean(),
  keepAttachments: z.boolean(),
  keepComments: z.boolean(),
});

export type CopyCardInput = z.infer<typeof CopyCard>;
export type CopyCardResult = ActionState<CopyCardInput, Card>;
