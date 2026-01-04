"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { ArrowDownAZ, ArrowUpAZ, BarChart3, CalendarClock, CheckCircle2, ClockAlert, Inbox } from "lucide-react";
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

import { useCardModal } from "@/hooks/use-card-modal";
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
  kpis: Kpis;
  listDistribution: ChartPoint[];
  workload: ChartPoint[];
  scheduleHealth: SchedulePoint[];
  insights: {
    overdueCards: OverdueCardInsight[];
  };
};

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
