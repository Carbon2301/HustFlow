import { addDays, differenceInCalendarDays, format, isAfter, isBefore, startOfDay } from "date-fns";
import { vi } from "date-fns/locale";

import type {
  BoardTimelineCard,
  BoardTimelineList,
} from "@/types";

import type {
  ScheduledCard,
  TimelineDateOverride,
  TimelineDerivedData,
  TimelineUnit,
  TimelineZoom,
} from "../_types";
import {
  formatTimelineDate,
  getTimelineUnits,
  parseTimelineDate,
} from "./date-utils";

export const ROW_HEIGHT = 48;
export const HEADER_HEIGHT = 48;
export const BAR_HEIGHT = 32;
export const BAR_VERTICAL_OFFSET = (ROW_HEIGHT - BAR_HEIGHT) / 2;
export const MIN_GRID_WIDTH = 520;
export const GANTT_MAX_HEIGHT = "calc(100vh - 12rem)";

export const COLUMN_WIDTH_BY_ZOOM: Record<TimelineZoom, number> = {
  day: 56,
  week: 96,
  month: 120,
};

export const getCardSchedule = (card: BoardTimelineCard): ScheduledCard | null => {
  const startDate = parseTimelineDate(card.startDate);
  const dueDate = parseTimelineDate(card.dueDate);

  if (!startDate && !dueDate) {
    return null;
  }

  if (startDate && dueDate) {
    return {
      card,
      start: isAfter(startDate, dueDate) ? dueDate : startDate,
      end: isAfter(startDate, dueDate) ? startDate : dueDate,
      isMilestone: false,
      hasInvalidRange: isAfter(startDate, dueDate),
    };
  }

  const singleDate = startDate ?? dueDate;

  if (!singleDate) {
    return null;
  }

  return {
    card,
    start: singleDate,
    end: startDate && !dueDate ? addDays(singleDate, 1) : singleDate,
    isMilestone: !startDate || !dueDate,
    hasInvalidRange: false,
  };
};

export const getUnitForDate = (units: TimelineUnit[], date: Date) => {
  const index = units.findIndex((unit) => (
    !isBefore(date, unit.start) && !isAfter(date, unit.end)
  ));

  if (index === -1) {
    return date.getTime() < units[0]?.start.getTime()
      ? 0
      : Math.max(0, units.length - 1);
  }

  return index;
};

export const getTimelinePlacement = (
  row: ScheduledCard,
  units: TimelineUnit[],
  columnWidth: number,
) => {
  const startIndex = getUnitForDate(units, row.start);
  const endIndex = getUnitForDate(units, row.end);
  const orderedStartIndex = Math.min(startIndex, endIndex);
  const orderedEndIndex = Math.max(startIndex, endIndex);
  const span = Math.max(1, orderedEndIndex - orderedStartIndex + 1);
  const left = orderedStartIndex * columnWidth;
  const width = span * columnWidth;

  return {
    startIndex: orderedStartIndex,
    endIndex: orderedEndIndex,
    span,
    left,
    width,
  };
};

export const getTimelineBounds = (cards: ScheduledCard[]) => {
  if (cards.length === 0) {
    const today = startOfDay(new Date());

    return {
      start: today,
      end: addDays(today, 30),
    };
  }

  const starts = cards.map((item) => item.start.getTime());
  const ends = cards.map((item) => item.end.getTime());

  return {
    start: addDays(new Date(Math.min(...starts)), -7),
    end: addDays(new Date(Math.max(...ends)), 7),
  };
};

export const isCardOverdue = (card: BoardTimelineCard) => {
  const dueDate = parseTimelineDate(card.dueDate);

  return Boolean(dueDate && isBefore(dueDate, startOfDay(new Date())) && !card.isCompleted);
};

export const getCardTimelineTitle = (row: ScheduledCard) => {
  const prefix = row.hasInvalidRange ? "Khoảng ngày cần kiểm tra: " : "";

  if (row.isMilestone) {
    return `${prefix}${row.card.title} - Mốc ${formatTimelineDate(row.card.startDate ?? row.card.dueDate)}`;
  }

  return `${prefix}${row.card.title} - ${formatTimelineDate(row.card.startDate)} đến ${formatTimelineDate(row.card.dueDate)}`;
};

export const getCardTone = (card: BoardTimelineCard, hasInvalidRange: boolean) => {
  if (hasInvalidRange) {
    return "border-orange-300 bg-orange-100 text-orange-900";
  }

  if (card.isCompleted) {
    return "border-emerald-200 bg-emerald-100 text-emerald-800";
  }

  if (isCardOverdue(card)) {
    return "border-rose-300 bg-rose-100 text-rose-800";
  }

  if (card.unresolvedBlockerCount > 0) {
    return "border-amber-300 bg-amber-100 text-amber-900";
  }

  return "border-blue-300 bg-blue-100 text-blue-800";
};

export const getUnscheduledCardMeta = (card: BoardTimelineCard) => {
  const meta = [];

  if (card.assignees.length > 0) {
    meta.push(`${card.assignees.length} thành viên`);
  }

  if (card.checklistProgress.total > 0) {
    meta.push(`${card.checklistProgress.completed}/${card.checklistProgress.total} checklist`);
  }

  if (card.commentCount > 0) {
    meta.push(`${card.commentCount} bình luận`);
  }

  if (card.attachmentCount > 0) {
    meta.push(`${card.attachmentCount} tệp`);
  }

  return meta;
};

export const applyTimelineDateOverrides = (
  lists: BoardTimelineList[],
  dateOverrides: Record<string, TimelineDateOverride>,
) => lists.map((list) => ({
  ...list,
  cards: list.cards.map((card) => {
    const override = dateOverrides[card.id];

    if (!override) {
      return card;
    }

    return {
      ...card,
      startDate: override.startDate,
      dueDate: override.dueDate,
    };
  }),
}));

export const getTimelineDerivedData = (
  lists: BoardTimelineList[],
  zoom: TimelineZoom,
): TimelineDerivedData => {
  const allCards = lists.flatMap((list) => list.cards);
  const scheduledCards = allCards
    .map(getCardSchedule)
    .filter((item): item is ScheduledCard => Boolean(item))
    .sort((left, right) => {
      const startDelta = differenceInCalendarDays(left.start, right.start);

      if (startDelta !== 0) {
        return startDelta;
      }

      return left.card.listOrder - right.card.listOrder ||
        left.card.order - right.card.order;
    });
  const unscheduledCards = allCards
    .filter((card) => !card.startDate && !card.dueDate)
    .sort((left, right) => left.listOrder - right.listOrder || left.order - right.order);
  const bounds = getTimelineBounds(scheduledCards);
  const units = getTimelineUnits(bounds.start, bounds.end, zoom);

  return {
    allCards,
    scheduledCards,
    unscheduledCards,
    timelineStart: bounds.start,
    timelineEnd: bounds.end,
    units,
    stats: {
      totalCards: allCards.length,
      unscheduledCards: unscheduledCards.length,
    },
  };
};

export const formatTimelineRangeEndpoint = (date: Date) =>
  format(date, "dd/MM/yyyy", { locale: vi });
