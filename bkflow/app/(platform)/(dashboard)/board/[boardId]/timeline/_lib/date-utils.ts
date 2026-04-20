import {
  addDays,
  addMonths,
  eachDayOfInterval,
  eachMonthOfInterval,
  eachWeekOfInterval,
  format,
  isAfter,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { vi } from "date-fns/locale";

import type {
  TimelineDateOverride,
  TimelineInteraction,
  TimelineUnit,
  TimelineZoom,
} from "../_types";

export const zoomLabels: Record<TimelineZoom, string> = {
  day: "Ngày",
  week: "Tuần",
  month: "Tháng",
};

export const parseTimelineDate = (value: string | null) => {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return startOfDay(date);
};

export const parseCardDateTime = (value: string | null) => {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
};

export const formatTimelineDate = (value: string | null) => {
  const date = parseTimelineDate(value);

  if (!date) {
    return "Chưa đặt";
  }

  return format(date, "dd/MM/yyyy", { locale: vi });
};

export const getTimelineUnits = (
  start: Date,
  end: Date,
  zoom: TimelineZoom,
): TimelineUnit[] => {
  if (zoom === "day") {
    return eachDayOfInterval({ start, end }).map((date) => ({
      key: format(date, "yyyy-MM-dd"),
      label: format(date, "dd/MM", { locale: vi }),
      start: date,
      end: date,
    }));
  }

  if (zoom === "week") {
    return eachWeekOfInterval(
      { start, end },
      { weekStartsOn: 1 },
    ).map((date) => ({
      key: `week:${format(date, "yyyy-MM-dd")}`,
      label: `Tuần ${format(date, "dd/MM", { locale: vi })}`,
      start: startOfWeek(date, { weekStartsOn: 1 }),
      end: addDays(startOfWeek(date, { weekStartsOn: 1 }), 6),
    }));
  }

  return eachMonthOfInterval({ start, end }).map((date) => ({
    key: `month:${format(date, "yyyy-MM")}`,
    label: format(date, "MM/yyyy", { locale: vi }),
    start: startOfMonth(date),
    end: addDays(startOfMonth(new Date(date.getFullYear(), date.getMonth() + 1, 1)), -1),
  }));
};

export const shiftTimelineDate = (
  date: Date,
  deltaUnits: number,
  zoom: TimelineZoom,
) => {
  if (zoom === "month") {
    return addMonths(date, deltaUnits);
  }

  return addDays(date, zoom === "week" ? deltaUnits * 7 : deltaUnits);
};

export const getInteractionDateRange = (
  interaction: TimelineInteraction,
  zoom: TimelineZoom,
) => {
  if (interaction.mode === "move-milestone") {
    const originalSingleDate = interaction.originalSingleDate ??
      interaction.originalStartDate;
    const nextSingleDate = shiftTimelineDate(
      originalSingleDate,
      interaction.deltaUnits,
      zoom,
    );

    return {
      startDate: interaction.singleDateField === "startDate"
        ? nextSingleDate
        : interaction.originalStartDate,
      dueDate: interaction.singleDateField === "dueDate"
        ? nextSingleDate
        : interaction.originalDueDate,
    };
  }

  if (interaction.mode === "move") {
    return {
      startDate: shiftTimelineDate(
        interaction.originalStartDate,
        interaction.deltaUnits,
        zoom,
      ),
      dueDate: shiftTimelineDate(
        interaction.originalDueDate,
        interaction.deltaUnits,
        zoom,
      ),
    };
  }

  if (interaction.mode === "resize-start") {
    return {
      startDate: shiftTimelineDate(
        interaction.originalStartDate,
        interaction.deltaUnits,
        zoom,
      ),
      dueDate: interaction.originalDueDate,
    };
  }

  return {
    startDate: interaction.originalStartDate,
    dueDate: shiftTimelineDate(
      interaction.originalDueDate,
      interaction.deltaUnits,
      zoom,
    ),
  };
};

export const getInteractionDateOverride = (
  interaction: TimelineInteraction,
  zoom: TimelineZoom,
): TimelineDateOverride => {
  const nextRange = getInteractionDateRange(interaction, zoom);

  if (interaction.mode === "move-milestone") {
    return {
      startDate: interaction.singleDateField === "startDate"
        ? nextRange.startDate.toISOString()
        : null,
      dueDate: interaction.singleDateField === "dueDate"
        ? nextRange.dueDate.toISOString()
        : null,
    };
  }

  return {
    startDate: nextRange.startDate.toISOString(),
    dueDate: nextRange.dueDate.toISOString(),
  };
};

export const hasSameDateRange = (
  leftStartDate: Date,
  leftDueDate: Date,
  rightStartDate: Date,
  rightDueDate: Date,
) => (
  leftStartDate.getTime() === rightStartDate.getTime() &&
  leftDueDate.getTime() === rightDueDate.getTime()
);

export const isInvalidTimelineRange = (startDate: Date, dueDate: Date) =>
  isAfter(startDate, dueDate);
