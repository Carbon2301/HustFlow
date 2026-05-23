"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { fetcher } from "@/lib/fetcher";
import {
  boardFiltersAreActive,
  calendarItemMatchesBoardFilters,
  unscheduledCardMatchesBoardFilters,
} from "@/lib/boards/board-filters";
import type { BoardFilterState } from "@/hooks/use-board-filters";
import type { BoardCalendarResponse } from "@/types";

import {
  MAX_DAY_LANES,
  MAX_MOBILE_DAY_LANES,
} from "../_components/board-calendar/constants";
import {
  getDayGridRange,
  getDayKey,
  getMonthGridRange,
  getWeekGridRange,
} from "../_components/board-calendar/date-utils";
import {
  getDayViewBlocks,
  getOverlappingDayBlockLayout,
} from "../_components/board-calendar/day-view-layout";
import {
  getOccurrences,
  getRanges,
  getRangeOccurrencesByDay,
  getRangeSegmentsForWeeks,
  getWeekRows,
} from "../_components/board-calendar/range-layout";
import type {
  CalendarOccurrence,
  DayViewBlock,
  ViewMode,
} from "../_components/board-calendar/types";

type UseCalendarQueryOptions = {
  boardId: string;
  viewMode: ViewMode;
  anchorDate: Date;
  filters: BoardFilterState;
  currentBoardMemberId: string;
};

export const useCalendarQuery = ({
  boardId,
  viewMode,
  anchorDate,
  filters,
  currentBoardMemberId,
}: UseCalendarQueryOptions) => {
  const { fromIso, toIso, days } = useMemo(
    () => {
      if (viewMode === "month") {
        return getMonthGridRange(anchorDate);
      }

      if (viewMode === "week") {
        return getWeekGridRange(anchorDate);
      }

      return getDayGridRange(anchorDate);
    },
    [anchorDate, viewMode],
  );

  const query = useQuery<BoardCalendarResponse>({
    queryKey: ["board-calendar", boardId, viewMode, fromIso, toIso],
    queryFn: () =>
      fetcher(
        `/api/boards/${boardId}/calendar?from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}&includeUnscheduled=true`,
      ),
  });

  const responseItems = query.data?.items;
  const unfilteredItems = useMemo(() => responseItems ?? [], [responseItems]);
  const unscheduledCards = useMemo(
    () => query.data?.unscheduledCards ?? [],
    [query.data?.unscheduledCards],
  );
  const filtersAreActive = useMemo(() => boardFiltersAreActive(filters), [filters]);
  const items = useMemo(
    () => unfilteredItems.filter((item) =>
      calendarItemMatchesBoardFilters(item, filters, currentBoardMemberId),
    ),
    [currentBoardMemberId, filters, unfilteredItems],
  );
  const filteredUnscheduledCards = useMemo(() => {
    return unscheduledCards.filter((card) =>
      unscheduledCardMatchesBoardFilters(card, filters, currentBoardMemberId),
    );
  }, [currentBoardMemberId, filters, unscheduledCards]);
  const occurrences = useMemo(() => getOccurrences(items), [items]);
  const ranges = useMemo(() => getRanges(items), [items]);
  const dayViewBlocks = useMemo(
    () => getDayViewBlocks(items, anchorDate),
    [anchorDate, items],
  );
  const dayViewBlocksById = useMemo(() => {
    return dayViewBlocks.reduce<Record<string, DayViewBlock>>((acc, block) => {
      acc[block.id] = block;

      return acc;
    }, {});
  }, [dayViewBlocks]);
  const desktopDayViewLayout = useMemo(
    () => getOverlappingDayBlockLayout(dayViewBlocks, MAX_DAY_LANES),
    [dayViewBlocks],
  );
  const mobileDayViewLayout = useMemo(
    () => getOverlappingDayBlockLayout(dayViewBlocks, MAX_MOBILE_DAY_LANES),
    [dayViewBlocks],
  );
  const weekRows = useMemo(() => getWeekRows(days), [days]);
  const daysByKey = useMemo(() => {
    return days.reduce<Record<string, Date>>((acc, day) => {
      acc[getDayKey(day)] = day;

      return acc;
    }, {});
  }, [days]);
  const rangeSegmentsByWeek = useMemo(
    () => getRangeSegmentsForWeeks(ranges, weekRows),
    [ranges, weekRows],
  );
  const rangeOccurrencesByDay = useMemo(
    () => getRangeOccurrencesByDay(ranges, days),
    [ranges, days],
  );
  const occurrencesById = useMemo(() => {
    return occurrences.reduce<Record<string, CalendarOccurrence>>((acc, occurrence) => {
      acc[occurrence.id] = occurrence;

      return acc;
    }, {});
  }, [occurrences]);
  const occurrencesByDay = useMemo(() => {
    return occurrences.reduce<Record<string, CalendarOccurrence[]>>((acc, occurrence) => {
      const key = getDayKey(occurrence.date);
      acc[key] = [...(acc[key] ?? []), occurrence].sort((left, right) => {
        const timeDelta = left.date.getTime() - right.date.getTime();

        if (timeDelta !== 0) {
          return timeDelta;
        }

        if (left.item.isCompleted !== right.item.isCompleted) {
          return left.item.isCompleted ? 1 : -1;
        }

        return left.item.title.localeCompare(right.item.title, "vi");
      });

      return acc;
    }, {});
  }, [occurrences]);

  return {
    fromIso,
    toIso,
    days,
    query,
    responseItems,
    unfilteredItems,
    unscheduledCards,
    filtersAreActive,
    items,
    filteredUnscheduledCards,
    occurrences,
    ranges,
    dayViewBlocks,
    dayViewBlocksById,
    desktopDayViewLayout,
    mobileDayViewLayout,
    weekRows,
    daysByKey,
    rangeSegmentsByWeek,
    rangeOccurrencesByDay,
    occurrencesById,
    occurrencesByDay,
  };
};
