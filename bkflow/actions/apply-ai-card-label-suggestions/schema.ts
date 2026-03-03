import { z } from "zod";

export const ApplyAiCardLabelSuggestions = z.object({
  boardId: z.string(),
  cardId: z.string(),
  labelIds: z.array(z.string()).min(1, {
    message: "Vui lòng chọn ít nhất một nhãn.",
  }).max(3, {
    message: "Chỉ có thể gắn tối đa 3 nhãn mỗi lần.",
  }),
});
