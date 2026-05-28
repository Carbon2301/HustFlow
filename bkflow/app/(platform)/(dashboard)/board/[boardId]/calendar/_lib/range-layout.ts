import { isSameDay } from "date-fns";

import type { BoardCalendarItem } from "@/types";

import {
  compareDay,
  getDayKey,
  getLocalDay,
  parseCalendarDate,
} from "./date-utils";
import {
  getCalendarItemDueDate,
  getCalendarItemStartDate,
  isCalendarCardItem,
} from "./item-utils";
import type {
  CalendarOccurrence,
  CalendarRange,
  CalendarRangeSegment,
} from "../_types";

export const getOccurrences = (items: BoardCalendarItem[]) =>
  items.reduce<CalendarOccurrence[]>((acc, item) => {
    const startDate = parseCalendarDate(getCalendarItemStartDate(item));
    const dueDate = parseCalendarDate(getCalendarItemDueDate(item));

    if (startDate && dueDate) {
      if (isSameDay(startDate, dueDate)) {
        acc.push({
          id: `${item.id}:single:${getDayKey(startDate)}`,
          kind: "single",
          date: startDate,
          item,
        });
        return acc;
      }

      return acc;
    }

    const date = startDate ?? dueDate;

    if (!date) {
      return acc;
    }

    acc.push({
      id: `${item.id}:single:${getDayKey(date)}`,
      kind: "single",
      date,
      item,
    });

    return acc;
  }, []);

export const getRanges = (items: BoardCalendarItem[]) =>
  items.reduce<CalendarRange[]>((acc, item) => {
    if (!isCalendarCardItem(item)) {
      return acc;
    }

    const startDate = parseCalendarDate(item.startDate);
    const dueDate = parseCalendarDate(item.dueDate);

    if (!startDate || !dueDate || isSameDay(startDate, dueDate)) {
      return acc;
    }

    const orderedStart = compareDay(startDate, dueDate) <= 0 ? startDate : dueDate;
    const orderedEnd = compareDay(startDate, dueDate) <= 0 ? dueDate : startDate;

    acc.push({
      id: `${item.cardId}:range:${getDayKey(orderedStart)}:${getDayKey(orderedEnd)}`,
      item,
      startDate: getLocalDay(orderedStart),
      endDate: getLocalDay(orderedEnd),
      startKey: getDayKey(orderedStart),
      endKey: getDayKey(orderedEnd),
    });

    return acc;
  }, []);

export const getWeekRows = (days: Date[]) => {
  const rows: Date[][] = [];

  for (let index = 0; index < days.length; index += 7) {
    rows.push(days.slice(index, index + 7));
  }

  return rows;
};

export const getRangeSegmentsForWeeks = (
  ranges: CalendarRange[],
  weekRows: Date[][],
) =>
  weekRows.map((weekDays, weekIndex) => {
    const weekStart = getLocalDay(weekDays[0]);
    const weekEnd = getLocalDay(weekDays[weekDays.length - 1]);
    const segments = ranges.reduce<CalendarRangeSegment[]>((acc, range) => {
      if (
        compareDay(range.endDate, weekStart) < 0 ||
        compareDay(range.startDate, weekEnd) > 0
      ) {
        return acc;
      }

      const segmentStart = compareDay(range.startDate, weekStart) < 0
        ? weekStart
        : range.startDate;
      const segmentEnd = compareDay(range.endDate, weekEnd) > 0
        ? weekEnd
        : range.endDate;
      const startIndex = weekDays.findIndex((day) => getDayKey(day) === getDayKey(segmentStart));
      const endIndex = weekDays.findIndex((day) => getDayKey(day) === getDayKey(segmentEnd));

      if (startIndex < 0 || endIndex < 0) {
        return acc;
      }

      acc.push({
        id: `${range.id}:week:${weekIndex}`,
        range,
        weekIndex,
        startIndex,
        endIndex,
        lane: 0,
        isRangeStart: getDayKey(segmentStart) === range.startKey,
        isRangeEnd: getDayKey(segmentEnd) === range.endKey,
      });

      return acc;
    }, []).sort((left, right) => (
      left.startIndex - right.startIndex ||
      right.endIndex - left.endIndex ||
      left.range.item.title.localeCompare(right.range.item.title, "vi")
    ));

    const laneEnds: number[] = [];

    return segments.map((segment) => {
      const lane = laneEnds.findIndex((endIndex) => endIndex < segment.startIndex);
      const nextLane = lane >= 0 ? lane : laneEnds.length;
      laneEnds[nextLane] = segment.endIndex;

      return {
        ...segment,
        lane: nextLane,
      };
    });
  });

export const getRangeOccurrencesByDay = (ranges: CalendarRange[], days: Date[]) =>
  days.reduce<Record<string, CalendarOccurrence[]>>((acc, day) => {
    const dayKey = getDayKey(day);
    const dayDate = getLocalDay(day);
    const occurrences = ranges
      .filter((range) => (
        compareDay(range.startDate, dayDate) <= 0 &&
        compareDay(range.endDate, dayDate) >= 0
      ))
      .map<CalendarOccurrence>((range) => ({
        id: `${range.id}:day:${dayKey}`,
        kind: "range",
        date: day,
        item: range.item,
      }));

    if (occurrences.length > 0) {
      acc[dayKey] = occurrences;
    }

    return acc;
  }, {});
