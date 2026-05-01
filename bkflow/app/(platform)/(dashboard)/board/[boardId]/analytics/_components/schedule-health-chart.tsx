"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import type { Kpis, SchedulePoint } from "../_types";
import { legendColors, scheduleGradients } from "../_lib/chart-formatters";
import { CustomTooltip } from "./custom-tooltip";
import { EmptyState } from "./empty-state";

export const ScheduleHealthChart = ({
  kpis,
  data,
}: {
  kpis: Kpis;
  data: SchedulePoint[];
}) => {
  const hasScheduleHealth = data.some((item) => item.value > 0);

  if (!hasScheduleHealth) {
    return <EmptyState label="Chưa có dữ liệu hạn chót của thẻ." />;
  }

  return (
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
              data={data}
              cx="50%"
              cy="50%"
              dataKey="value"
              nameKey="name"
              innerRadius={68}
              outerRadius={92}
              paddingAngle={3}
              isAnimationActive={false}
            >
              {data.map((entry, index) => (
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
        {data.map((item, index) => (
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
  );
};
