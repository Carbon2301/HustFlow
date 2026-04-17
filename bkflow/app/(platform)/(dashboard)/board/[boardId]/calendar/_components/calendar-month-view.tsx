"use client";

import type { ComponentProps } from "react";

import { CalendarWeekRow } from "./board-calendar/calendar-week-row";

type CalendarWeekRowProps = ComponentProps<typeof CalendarWeekRow>;

type CalendarMonthViewProps = {
  weekRows: Date[][];
  rowProps: Omit<
    CalendarWeekRowProps,
    "weekDays" | "weekIndex" | "mode" | "weekRowsLength"
  >;
};

export const CalendarMonthView = ({
  weekRows,
  rowProps,
}: CalendarMonthViewProps) => (
  <div className="overflow-hidden rounded-b-lg border border-neutral-200 bg-white">
    {weekRows.map((weekDays, weekIndex) => (
      <CalendarWeekRow
        key={`week-row:${weekIndex}`}
        weekDays={weekDays}
        weekIndex={weekIndex}
        mode="month"
        weekRowsLength={weekRows.length}
        {...rowProps}
      />
    ))}
  </div>
);
