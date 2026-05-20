import type { AiBoardReport } from "@/actions/ai/generate-ai-board-report/types";

import type { ReportRange } from "../_types";

export const reportRangeLabels: Record<ReportRange, string> = {
  "7d": "7 ngày",
  "30d": "30 ngày",
};

export const formatReportMarkdown = (report: AiBoardReport, range: ReportRange) => {
  const section = (title: string, items: string[]) => [
    `## ${title}`,
    ...items.map((item) => `- ${item}`),
  ].join("\n");

  return [
    `# Báo cáo AI (${reportRangeLabels[range]})`,
    "",
    `## Tổng quan`,
    report.summary,
    "",
    section("Chỉ số", report.metrics.map((metric) => `${metric.label}: ${metric.value}`)),
    "",
    section("Đã hoàn thành", report.completed),
    "",
    section("Rủi ro", report.risks),
    "",
    section("Gợi ý hành động", report.actions),
  ].join("\n");
};
