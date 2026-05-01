"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { ChartPoint } from "../_types";
import { chartTickStyle, formatAxisName, getScrollableChartHeight } from "../_lib/chart-formatters";
import { ChartScrollFrame } from "./chart-scroll-frame";
import { CustomTooltip } from "./custom-tooltip";
import { EmptyState } from "./empty-state";

export const ListDistributionChart = ({
  data,
  hasCards,
}: {
  data: ChartPoint[];
  hasCards: boolean;
}) => {
  const hasListDistribution = data.some((item) => item.count > 0);

  if (!hasListDistribution) {
    return (
      <EmptyState label={hasCards ? "Chưa có danh sách nào có thẻ." : "Bảng chưa có thẻ."} />
    );
  }

  return (
    <ChartScrollFrame height={getScrollableChartHeight(data.length)}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 16, left: 10, bottom: 0 }}>
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
  );
};
