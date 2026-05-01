"use client";

export type Kpis = {
  totalCards: number;
  completedCards: number;
  overdueCards: number;
  unscheduledCards: number;
  completionRate: number;
};

export type ChartPoint = {
  id?: string;
  name: string;
  count: number;
};

export type SchedulePoint = {
  name: string;
  value: number;
};

export type LabelPreview = {
  id: string;
  title: string;
  color: string;
};

export type CardInsight = {
  id: string;
  title: string;
  listTitle: string;
  labels: LabelPreview[];
};

export type OverdueCardInsight = CardInsight & {
  dueDate: string;
};

export type ReportRange = "7d" | "30d";

export type BoardAnalyticsViewProps = {
  boardId: string;
  kpis: Kpis;
  listDistribution: ChartPoint[];
  workload: ChartPoint[];
  scheduleHealth: SchedulePoint[];
  insights: {
    overdueCards: OverdueCardInsight[];
  };
};
