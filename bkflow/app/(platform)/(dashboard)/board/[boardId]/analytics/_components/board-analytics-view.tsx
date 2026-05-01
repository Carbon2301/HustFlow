"use client";

import type { BoardAnalyticsViewProps } from "../_types";
import { AiReportPanel } from "./ai-report-panel";
import { ChartPanel } from "./chart-panel";
import { KpiRow } from "./kpi-row";
import { ListDistributionChart } from "./list-distribution-chart";
import { OverdueCardsPanel } from "./overdue-cards-panel";
import { ScheduleHealthChart } from "./schedule-health-chart";
import { WorkloadChart } from "./workload-chart";

export const BoardAnalyticsView = ({
  boardId,
  kpis,
  listDistribution,
  workload,
  scheduleHealth,
  insights,
}: BoardAnalyticsViewProps) => {
  const hasCards = kpis.totalCards > 0;

  return (
    <div className="h-full overflow-y-auto bg-black/30 p-6 font-sans styled-scrollbar">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 pb-8">
        <AiReportPanel boardId={boardId} />

        <KpiRow kpis={kpis} />

        <div className="grid gap-6 lg:grid-cols-2">
          <ChartPanel title="Phân bổ theo danh sách">
            <ListDistributionChart data={listDistribution} hasCards={hasCards} />
          </ChartPanel>

          <ChartPanel title="Khối lượng công việc thành viên">
            <WorkloadChart data={workload} />
          </ChartPanel>

          <ChartPanel title="Trạng thái hạn công việc">
            <ScheduleHealthChart kpis={kpis} data={scheduleHealth} />
          </ChartPanel>

          <OverdueCardsPanel overdueCards={insights.overdueCards} />
        </div>
      </div>
    </div>
  );
};
