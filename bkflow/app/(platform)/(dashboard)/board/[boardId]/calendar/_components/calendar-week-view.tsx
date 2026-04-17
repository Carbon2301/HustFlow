"use client";

import type { ComponentProps } from "react";

import { CalendarWeekRow } from "./board-calendar/calendar-week-row";

type CalendarWeekRowProps = ComponentProps<typeof CalendarWeekRow>;

type CalendarWeekViewProps = {
  days: Date[];
  weekRows: Date[][];
  rowProps: Omit<
    CalendarWeekRowProps,
    "weekDays" | "weekIndex" | "mode" | "weekRowsLength"
  >;
};

export const CalendarWeekView = ({
  days,
  weekRows,
  rowProps,
}: CalendarWeekViewProps) => (
  <CalendarWeekRow
    weekDays={weekRows[0] ?? days}
    weekIndex={0}
    mode="week"
    weekRowsLength={weekRows.length}
    {...rowProps}
  />
);
