import { z } from "zod";

export const AiBoardReportRange = z.enum(["7d", "30d"]);

export const GenerateAiBoardReport = z.object({
  boardId: z.string(),
  range: AiBoardReportRange,
});
