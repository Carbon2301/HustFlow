"use client";

import { BarChart3, CalendarClock, CheckCircle2, ClockAlert, Inbox } from "lucide-react";

import type { Kpis } from "../_types";
import { KpiCard } from "./kpi-card";

export const KpiRow = ({ kpis }: { kpis: Kpis }) => (
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
);
