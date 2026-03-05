"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { ArrowDownAZ, ArrowUpAZ, BarChart3, CalendarClock, CheckCircle2, Clipboard, ClockAlert, Inbox, RefreshCw, Sparkles } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TooltipContentProps, TooltipValueType } from "recharts";
import { toast } from "sonner";

import { generateAiBoardReport } from "@/actions/generate-ai-board-report";
import type { AiBoardReport } from "@/actions/generate-ai-board-report/types";
import { useCardModal } from "@/hooks/use-card-modal";
import { useAction } from "@/hooks/use-action";
import { cn } from "@/lib/utils";

type Kpis = {
  totalCards: number;
  completedCards: number;
  overdueCards: number;
  unscheduledCards: number;
  completionRate: number;
};

type ChartPoint = {
  id?: string;
  name: string;
  count: number;
};

type SchedulePoint = {
  name: string;
  value: number;
};

type LabelPreview = {
  id: string;
  title: string;
  color: string;
};

type CardInsight = {
  id: string;
  title: string;
  listTitle: string;
  labels: LabelPreview[];
};

type OverdueCardInsight = CardInsight & {
  dueDate: string;
};

type BoardAnalyticsViewProps = {
  boardId: string;
  kpis: Kpis;
  listDistribution: ChartPoint[];
  workload: ChartPoint[];
  scheduleHealth: SchedulePoint[];
  insights: {
    overdueCards: OverdueCardInsight[];
  };
};

type ReportRange = "7d" | "30d";

const legendColors = ["#10b981", "#3b82f6", "#f43f5e", "#737373"];
const scheduleGradients = [
  "url(#colorCompleted)",
  "url(#colorActive)",
  "url(#colorOverdue)",
  "url(#colorUnscheduled)"
];

const getScrollableChartHeight = (items: number) => Math.max(280, Math.min(items * 38, 720));

const chartTickStyle = {
  fill: "#525252",
  fontFamily: "var(--font-sans)",
  fontSize: 11,
  fontWeight: 500,
};

const formatTooltipValue = (value: TooltipValueType | undefined) => {
  if (Array.isArray(value)) {
    return value.join(" - ");
  }

  return value ?? "";
};

const formatAxisName = (value: string) => (value.length > 18 ? `${value.slice(0, 17)}…` : value);

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));

const reportRangeLabels: Record<ReportRange, string> = {
  "7d": "7 ngày",
  "30d": "30 ngày",
};

const formatReportMarkdown = (report: AiBoardReport, range: ReportRange) => {
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

const EmptyState = ({ label }: { label: string }) => (
  <div className="flex h-[280px] flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-200 bg-neutral-50/50 p-6 text-center text-sm font-medium text-neutral-400 shadow-inner">
    <Inbox className="h-8 w-8 text-neutral-300 mb-2 stroke-[1.5]" />
    {label}
  </div>
);

const KpiCard = ({
  label,
  value,
  tone,
  icon: Icon,
  gradient,
}: {
  label: string;
  value: string | number;
  tone: string;
  icon: typeof Inbox;
  gradient: string;
}) => (
  <div className="relative overflow-hidden rounded-2xl border border-neutral-200/60 bg-white p-5 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:shadow-md group">
    {/* Decorative background glow */}
    <div className={cn("absolute -right-6 -bottom-6 h-24 w-24 rounded-full opacity-10 blur-xl transition-all duration-300 group-hover:scale-150", gradient)} />
    
    <div className="flex items-center justify-between">
      <div className="space-y-1.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{label}</span>
        <h3 className="text-2xl font-bold leading-none text-neutral-900">{value}</h3>
      </div>
      <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl shadow-xs transition-transform duration-300 group-hover:scale-110", tone)}>
        <Icon className="h-5 w-5" />
      </div>
    </div>
  </div>
);

const Panel = ({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) => (
  <section className={cn("rounded-2xl border border-neutral-200/60 bg-white p-5 shadow-xs transition-shadow duration-300 hover:shadow-sm flex flex-col", className)}>
    <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
      <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
      {action}
    </div>
    <div className="pt-4 flex-1">{children}</div>
  </section>
);

const ReportBullets = ({
  title,
  items,
}: {
  title: string;
  items: string[];
}) => (
  <div className="rounded-xl border border-neutral-100 bg-neutral-50/60 p-3">
    <h3 className="text-xs font-bold uppercase tracking-wide text-neutral-500">{title}</h3>
    <ul className="mt-2 space-y-1.5 text-sm text-neutral-700">
      {items.map((item) => (
        <li key={item} className="flex gap-2 leading-relaxed">
          <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-sky-500" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  </div>
);

const AiReportPanel = ({
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
      toast.success("AI đã tạo báo cáo.");
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
    <Panel
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
    </Panel>
  );
};

const ChartScrollFrame = ({
  children,
  height,
}: {
  children: ReactNode;
  height: number;
}) => (
  <div className="max-h-[360px] overflow-y-auto pr-1 styled-scrollbar">
    <div className="min-w-0" style={{ height }}>
      {children}
    </div>
  </div>
);

const CardInsightButton = ({
  card,
  meta,
}: {
  card: CardInsight;
  meta?: ReactNode;
}) => {
  const cardModal = useCardModal();

  return (
    <button
      type="button"
      onClick={() => cardModal.onOpen(card.id)}
      className="group w-full rounded-xl border border-neutral-200/60 bg-white p-3.5 text-left transition-all duration-200 hover:-translate-x-0.5 hover:border-rose-200 hover:shadow-xs hover:bg-neutral-50/50"
    >
      <div className="flex items-start justify-between gap-x-3">
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="line-clamp-2 text-sm font-bold text-neutral-800 leading-snug">
            {card.title}
          </p>
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs font-semibold text-neutral-400">
            <span className="bg-neutral-100 px-2 py-0.5 rounded text-[10px] text-neutral-500">
              {card.listTitle}
            </span>
            {meta}
          </div>
        </div>
      </div>
      {card.labels.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {card.labels.slice(0, 5).map((label) => (
            <span
              key={label.id}
              className="h-1.5 w-6 rounded-full"
              title={label.title}
              style={{ backgroundColor: label.color }}
            />
          ))}
        </div>
      )}
    </button>
  );
};

const CustomTooltip = ({
  active,
  payload,
  label,
}: TooltipContentProps<TooltipValueType, string | number>) => {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1.5 font-sans text-[11px] leading-tight text-white shadow-md">
      {label && (
        <p className="max-w-40 truncate text-center font-semibold text-white">
          {label}
        </p>
      )}
      <div className="mt-1 space-y-0.5">
        {payload.map((item) => (
          <div
            key={`${item.name ?? item.dataKey}`}
            className="flex items-center justify-center gap-1.5 whitespace-nowrap"
          >
            <span className="font-semibold text-white">{item.name}:</span>
            <span
              className="font-bold"
              style={{ color: item.color ?? item.fill ?? "#c4b5fd" }}
            >
              {formatTooltipValue(item.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export const BoardAnalyticsView = ({
  boardId,
  kpis,
  listDistribution,
  workload,
  scheduleHealth,
  insights,
}: BoardAnalyticsViewProps) => {
  const [overdueSort, setOverdueSort] = useState<"asc" | "desc">("asc");
  const hasCards = kpis.totalCards > 0;
  const hasListDistribution = listDistribution.some((item) => item.count > 0);
  const hasWorkload = workload.some((item) => item.count > 0);
  const hasScheduleHealth = scheduleHealth.some((item) => item.value > 0);
  const listChartHeight = getScrollableChartHeight(listDistribution.length);
  const workloadChartHeight = getScrollableChartHeight(workload.length);
  
  const sortedOverdueCards = useMemo(
    () =>
      [...insights.overdueCards].sort((left, right) => {
        const diff = new Date(left.dueDate).getTime() - new Date(right.dueDate).getTime();

        return overdueSort === "asc" ? diff : -diff;
      }),
    [insights.overdueCards, overdueSort],
  );

  return (
    <div className="h-full overflow-y-auto bg-black/30 p-6 font-sans styled-scrollbar">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 pb-8">
        <AiReportPanel boardId={boardId} />
        
        {/* KPI Row */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <KpiCard 
            label="Tổng số thẻ" 
            value={kpis.totalCards} 
            icon={Inbox} 
            tone="bg-sky-50 text-sky-600 border border-sky-100" 
            gradient="bg-sky-500" 
          />
          <KpiCard 
            label="Hoàn thành" 
            value={kpis.completedCards} 
            icon={CheckCircle2} 
            tone="bg-emerald-50 text-emerald-600 border border-emerald-100" 
            gradient="bg-emerald-500" 
          />
          <KpiCard 
            label="Quá hạn" 
            value={kpis.overdueCards} 
            icon={ClockAlert} 
            tone="bg-rose-50 text-rose-600 border border-rose-100" 
            gradient="bg-rose-500" 
          />
          <KpiCard 
            label="Chưa lên lịch" 
            value={kpis.unscheduledCards} 
            icon={CalendarClock} 
            tone="bg-amber-50 text-amber-600 border border-amber-100" 
            gradient="bg-amber-500" 
          />
          <KpiCard 
            label="Tỷ lệ hoàn thành" 
            value={`${kpis.completionRate}%`} 
            icon={BarChart3} 
            tone="bg-violet-50 text-violet-600 border border-violet-100" 
            gradient="bg-violet-500" 
          />
        </div>

        {/* Charts & Insights Grid */}
        <div className="grid gap-6 lg:grid-cols-2">
          
          {/* List Distribution */}
          <Panel title="Phân bổ theo danh sách">
            {hasListDistribution ? (
              <ChartScrollFrame height={listChartHeight}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={listDistribution} layout="vertical" margin={{ top: 8, right: 16, left: 10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="listBarGradient" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.85} />
                        <stop offset="100%" stopColor="#6366f1" stopOpacity={1} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                    <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} tick={chartTickStyle} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={100}
                      tickFormatter={formatAxisName}
                      tickLine={false}
                      axisLine={false}
                      tick={chartTickStyle}
                    />
                    <Tooltip
                      cursor={{ fill: "#f8fafc" }}
                      content={(props) => <CustomTooltip {...props} />}
                    />
                    <Bar dataKey="count" name="Số thẻ" fill="url(#listBarGradient)" radius={[0, 6, 6, 0]} barSize={16} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartScrollFrame>
            ) : (
              <EmptyState label={hasCards ? "Chưa có danh sách nào có thẻ." : "Bảng chưa có thẻ."} />
            )}
          </Panel>

          {/* Workload */}
          <Panel title="Khối lượng công việc thành viên">
            {hasWorkload ? (
              <ChartScrollFrame height={workloadChartHeight}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={workload} layout="vertical" margin={{ top: 8, right: 16, left: 10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="workloadBarGradient" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#0d9488" stopOpacity={0.85} />
                        <stop offset="100%" stopColor="#0f766e" stopOpacity={1} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                    <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} tick={chartTickStyle} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={100}
                      tickFormatter={formatAxisName}
                      tickLine={false}
                      axisLine={false}
                      tick={chartTickStyle}
                    />
                    <Tooltip
                      cursor={{ fill: "#f8fafc" }}
                      content={(props) => <CustomTooltip {...props} />}
                    />
                    <Bar dataKey="count" name="Lượt giao" fill="url(#workloadBarGradient)" radius={[0, 6, 6, 0]} barSize={16} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartScrollFrame>
            ) : (
              <EmptyState label="Chưa có thẻ được giao cho thành viên." />
            )}
          </Panel>

          {/* Schedule Health */}
          <Panel title="Trạng thái hạn công việc">
            {hasScheduleHealth ? (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-6 py-4">
                <div className="relative h-[220px] w-[220px] flex items-center justify-center flex-shrink-0">
                  <div className="absolute flex flex-col items-center justify-center text-center">
                    <span className="text-2xl font-bold text-neutral-900">{kpis.completionRate}%</span>
                    <span className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">Hoàn thành</span>
                  </div>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <defs>
                        <linearGradient id="colorCompleted" x1="0" y1="0" x2="1" y2="1">
                          <stop offset="0%" stopColor="#10b981" />
                          <stop offset="100%" stopColor="#34d399" />
                        </linearGradient>
                        <linearGradient id="colorActive" x1="0" y1="0" x2="1" y2="1">
                          <stop offset="0%" stopColor="#3b82f6" />
                          <stop offset="100%" stopColor="#60a5fa" />
                        </linearGradient>
                        <linearGradient id="colorOverdue" x1="0" y1="0" x2="1" y2="1">
                          <stop offset="0%" stopColor="#f43f5e" />
                          <stop offset="100%" stopColor="#fda4af" />
                        </linearGradient>
                        <linearGradient id="colorUnscheduled" x1="0" y1="0" x2="1" y2="1">
                          <stop offset="0%" stopColor="#737373" />
                          <stop offset="100%" stopColor="#a3a3a3" />
                        </linearGradient>
                      </defs>
                      <Pie
                        data={scheduleHealth}
                        cx="50%"
                        cy="50%"
                        dataKey="value"
                        nameKey="name"
                        innerRadius={68}
                        outerRadius={92}
                        paddingAngle={3}
                        isAnimationActive={false}
                      >
                        {scheduleHealth.map((entry, index) => (
                          <Cell key={entry.name} fill={scheduleGradients[index % scheduleGradients.length]} />
                        ))}
                      </Pie>
                       <Tooltip
                         content={(props) => <CustomTooltip {...props} />}
                         isAnimationActive={false}
                         cursor={false}
                       />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                
                <div className="flex-1 w-full space-y-3.5">
                  {scheduleHealth.map((item, index) => (
                    <div key={item.name} className="flex items-center justify-between border-b border-neutral-100 pb-1.5 last:border-0 last:pb-0">
                      <div className="flex items-center gap-2.5">
                        <span className="h-3 w-3 rounded-full shadow-xs" style={{ backgroundColor: legendColors[index] }} />
                        <span className="text-xs font-semibold text-neutral-600">{item.name}</span>
                      </div>
                      <span className="text-xs font-bold text-neutral-800">{item.value} thẻ</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <EmptyState label="Chưa có dữ liệu hạn chót của thẻ." />
            )}
          </Panel>

          {/* Overdue Cards */}
          <Panel
            title={`Danh sách thẻ quá hạn (${sortedOverdueCards.length})`}
            action={
              sortedOverdueCards.length > 1 && (
                <button
                  type="button"
                  onClick={() => setOverdueSort((current) => (current === "asc" ? "desc" : "asc"))}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 text-xs font-semibold text-neutral-600 transition hover:bg-neutral-50 hover:text-neutral-800 shadow-xs cursor-pointer"
                  title={overdueSort === "asc" ? "Đổi sang hạn xa nhất trước" : "Đổi sang hạn gần nhất trước"}
                >
                  {overdueSort === "asc" ? (
                    <ArrowUpAZ className="h-3.5 w-3.5 text-neutral-400" />
                  ) : (
                    <ArrowDownAZ className="h-3.5 w-3.5 text-neutral-400" />
                  )}
                  {overdueSort === "asc" ? "Cũ nhất" : "Mới nhất"}
                </button>
              )
            }
          >
            {sortedOverdueCards.length > 0 ? (
              <div className="max-h-[290px] overflow-y-auto pr-1 space-y-2.5 styled-scrollbar">
                {sortedOverdueCards.map((card) => (
                  <CardInsightButton
                    key={card.id}
                    card={card}
                    meta={<span className="font-bold text-rose-500">Hạn {formatDate(card.dueDate)}</span>}
                  />
                ))}
              </div>
            ) : (
              <EmptyState label="Hiện không có thẻ nào quá hạn." />
            )}
          </Panel>

        </div>
      </div>
    </div>
  );
};
