"use client";

import { useState } from "react";
import { Clipboard, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { generateAiBoardReport } from "@/actions/generate-ai-board-report";
import type { AiBoardReport } from "@/actions/generate-ai-board-report/types";
import { useAction } from "@/hooks/use-action";
import { cn } from "@/lib/utils";

import type { ReportRange } from "../_types";
import { formatReportMarkdown, reportRangeLabels } from "../_lib/ai-report-markdown";
import { ChartPanel } from "./chart-panel";
import { ReportBullets } from "./report-bullets";

export const AiReportPanel = ({
  boardId,
}: {
  boardId: string;
}) => {
  const [range, setRange] = useState<ReportRange>("7d");
  const [report, setReport] = useState<AiBoardReport | null>(null);
  const [reportRange, setReportRange] = useState<ReportRange>("7d");
  const [panelError, setPanelError] = useState("");

  const { execute, isLoading } = useAction(generateAiBoardReport, {
    onSuccess: (data) => {
      setReport(data);
      setReportRange(range);
      setPanelError("");
    },
    onError: (error) => {
      setPanelError(error);
      toast.error(error);
    },
  });

  const handleGenerate = () => {
    setPanelError("");
    execute({
      boardId,
      range,
    });
  };

  const handleCopy = async () => {
    if (!report) {
      return;
    }

    try {
      await navigator.clipboard.writeText(formatReportMarkdown(report, reportRange));
      toast.success("Đã copy báo cáo.");
    } catch {
      toast.error("Không thể copy báo cáo. Hãy thử lại.");
    }
  };

  return (
    <ChartPanel
      title="Báo cáo AI"
      className="border-sky-100 bg-white"
      action={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="inline-flex h-8 rounded-lg border border-neutral-200 bg-neutral-50 p-0.5">
            {(["7d", "30d"] as ReportRange[]).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setRange(item)}
                disabled={isLoading}
                className={cn(
                  "rounded-md px-3 text-xs font-bold transition disabled:opacity-50",
                  range === item
                    ? "bg-white text-sky-700 shadow-xs"
                    : "text-neutral-500 hover:text-neutral-800",
                )}
              >
                {reportRangeLabels[item]}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isLoading}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-sky-600 px-3 text-xs font-bold text-white shadow-xs transition hover:bg-sky-700 disabled:cursor-wait disabled:opacity-60"
          >
            {isLoading ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            {isLoading ? "Đang tạo..." : "Tạo báo cáo bằng AI"}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {!report && !isLoading && !panelError && (
          <div className="rounded-xl border border-dashed border-sky-200 bg-sky-50/50 px-4 py-6 text-sm font-medium text-sky-800">
            Chọn khoảng thời gian rồi tạo báo cáo. AI chỉ tóm tắt từ dữ liệu backend đã query và không tự tạo số liệu mới.
          </div>
        )}

        {isLoading && (
          <div className="flex min-h-32 items-center justify-center rounded-xl border border-sky-100 bg-sky-50/50 text-sm font-semibold text-sky-700">
            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            Đang tổng hợp dữ liệu và tạo báo cáo...
          </div>
        )}

        {panelError && !isLoading && (
          <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
            {panelError}
          </div>
        )}

        {report && !isLoading && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-sky-100 bg-sky-50/60 p-4">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold uppercase tracking-wide text-sky-700">
                  Tổng quan {reportRangeLabels[reportRange]}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-neutral-700">
                  {report.summary}
                </p>
              </div>
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-sky-200 bg-white px-3 text-xs font-bold text-sky-700 shadow-xs transition hover:bg-sky-50"
              >
                <Clipboard className="h-3.5 w-3.5" />
                Copy
              </button>
            </div>

            {report.metrics.length > 0 && (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {report.metrics.map((metric) => (
                  <div key={`${metric.label}-${metric.value}`} className="rounded-xl border border-neutral-100 bg-white p-3">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-neutral-400">
                      {metric.label}
                    </p>
                    <p className="mt-1 text-sm font-bold text-neutral-800">{metric.value}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="grid gap-3 lg:grid-cols-3">
              <ReportBullets title="Đã hoàn thành" items={report.completed} />
              <ReportBullets title="Rủi ro" items={report.risks} />
              <ReportBullets title="Gợi ý hành động" items={report.actions} />
            </div>
          </div>
        )}
      </div>
    </ChartPanel>
  );
};
