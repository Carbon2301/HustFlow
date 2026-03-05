"use server";

import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import { generateAiText } from "@/lib/ai/client";
import { parseAiJson } from "@/lib/ai/json";
import { getBoardAnalyticsData } from "@/lib/analytics/board-report-data";
import { createSafeAction } from "@/lib/create-safe-action";
import { requireBoardMember } from "@/lib/permissions";

import { GenerateAiBoardReport } from "./schema";
import { InputType, ReturnType } from "./types";

const bulletSchema = z.array(
  z.string()
    .transform((value) => value.replace(/\s+/g, " ").trim())
    .pipe(z.string().min(3).max(240)),
).min(1).max(6);

const AiBoardReportResponse = z.object({
  summary: z.string()
    .transform((value) => value.replace(/\s+/g, " ").trim())
    .pipe(z.string().min(20).max(700)),
  completed: bulletSchema,
  risks: bulletSchema,
  actions: bulletSchema,
  metrics: z.array(
    z.object({
      label: z.string()
        .transform((value) => value.replace(/\s+/g, " ").trim())
        .pipe(z.string().min(2).max(80)),
      value: z.string()
        .transform((value) => value.replace(/\s+/g, " ").trim())
        .pipe(z.string().min(1).max(80)),
    }),
  ).min(1).max(6),
});

const systemPrompt = [
  "Bạn là trợ lý báo cáo standup/weekly cho HustFlow.",
  "Chỉ trả JSON hợp lệ, không markdown wrapper, không giải thích ngoài JSON.",
  'Định dạng bắt buộc: {"summary":"...","completed":["..."],"risks":["..."],"actions":["..."],"metrics":[{"label":"...","value":"..."}]}.',
  "Viết tiếng Việt rõ ràng, ngắn gọn, giọng chuyên nghiệp.",
  "Chỉ dựa trên JSON context backend cung cấp. Không bịa số liệu, tên thẻ, deadline, người phụ trách hoặc activity không có trong context.",
  "Không nêu số liệu nếu số liệu đó không có trong context.",
  "Mỗi section completed, risks, actions có 3-6 bullet nếu đủ dữ liệu; nếu ít dữ liệu, có thể ít hơn nhưng phải có ít nhất 1 bullet.",
  "Nếu board ít dữ liệu, summary hoặc bullet phải nói rõ 'chưa đủ dữ liệu' và chỉ đưa gợi ý nhẹ dựa trên dữ liệu hiện có.",
  "Completed ưu tiên completedCardsInRange và recentActivity; nếu không có, nói chưa ghi nhận hoàn thành trong range.",
  "Risks dựa vào overdueCards, unassignedCards, heavyLists, checklistProgress.lowProgressCards và scheduleHealth.",
  "Actions phải bám trực tiếp vào risks. Không gợi ý người phụ trách cụ thể nếu context không chỉ rõ. Không invent deadline mới.",
].join("\n");

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId, orgId } = await auth();

  if (!userId || !orgId) {
    return { error: "Không có quyền truy cập." };
  }

  const { boardId, range } = data;

  try {
    const permission = await requireBoardMember({ boardId, orgId, userId });

    if (permission.error) {
      return { error: permission.error };
    }

    const analytics = await getBoardAnalyticsData({
      boardId,
      orgId,
      range,
      includeReportContext: true,
    });

    if (!analytics.reportContext) {
      return { error: "Không thể chuẩn bị dữ liệu báo cáo." };
    }

    const raw = await generateAiText({
      system: systemPrompt,
      user: JSON.stringify(analytics.reportContext),
      temperature: 0.2,
      maxTokens: 1100,
    });
    const parsed = parseAiJson(
      raw,
      AiBoardReportResponse,
      "AI chưa tạo được báo cáo đúng định dạng. Hãy thử lại.",
    );

    return {
      data: parsed,
    };
  } catch (error) {
    console.error("[GENERATE_AI_BOARD_REPORT_ERROR]", error);

    return {
      error: error instanceof Error
        ? error.message
        : "AI chưa tạo được báo cáo cho bảng này. Hãy thử lại.",
    };
  }
};

export const generateAiBoardReport = createSafeAction(GenerateAiBoardReport, handler);
