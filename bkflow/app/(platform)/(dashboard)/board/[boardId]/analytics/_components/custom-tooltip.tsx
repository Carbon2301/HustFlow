"use client";

import type { TooltipContentProps, TooltipValueType } from "recharts";

import { formatTooltipValue } from "../_lib/chart-formatters";

export const CustomTooltip = ({
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
