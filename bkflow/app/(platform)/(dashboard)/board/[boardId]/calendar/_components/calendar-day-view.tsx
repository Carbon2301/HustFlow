"use client";

import type { ComponentProps } from "react";

import { DayViewTimeGrid } from "./board-calendar/day-view-time-grid";

type CalendarDayViewProps = ComponentProps<typeof DayViewTimeGrid>;

type CalendarDayViewWrapperProps = {
  dayViewProps: CalendarDayViewProps;
};

export const CalendarDayView = ({
  dayViewProps,
}: CalendarDayViewWrapperProps) => (
  <DayViewTimeGrid {...dayViewProps} />
);
