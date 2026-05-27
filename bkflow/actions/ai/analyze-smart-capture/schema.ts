import { z } from "zod";

export const SMART_CAPTURE_RAW_TEXT_MAX_LENGTH = 4_000;

export const AnalyzeSmartCapture = z.object({
  boardId: z.string().min(1),
  rawText: z.string()
    .transform((value) => value.trim())
    .pipe(
      z.string()
        .min(1, { message: "Vui lòng dán nội dung cần phân tích." })
        .max(SMART_CAPTURE_RAW_TEXT_MAX_LENGTH, {
          message: "Nội dung quá dài. Vui lòng rút gọn tối đa 4000 ký tự.",
        }),
    ),
  timezoneOffsetMinutes: z.number().int().min(-14 * 60).max(14 * 60),
  nowIso: z.string().datetime(),
  timezoneLabel: z.string().optional(),
  localNowIso: z.string().optional(),
});
