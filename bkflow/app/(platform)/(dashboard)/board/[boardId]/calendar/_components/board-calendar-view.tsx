"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type MouseEvent,
  type PointerEvent,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
  subWeeks,
} from "date-fns";
import { vi } from "date-fns/locale";
import {
  AlertCircle,
  CalendarDays,
  CalendarX2,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Circle,
  Clock,
  ExternalLink,
  ListChecks,
  MessageSquare,
  MoreHorizontal,
  Plus,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";

import { Skeleton } from "@/components/ui/skeleton";
import { fetcher } from "@/lib/fetcher";
import { cn } from "@/lib/utils";
import { getDateTimezoneOffset } from "@/lib/date-utils";
import { useCardModal } from "@/hooks/use-card-modal";
import { Hint } from "@/components/hint";
import { useAction } from "@/hooks/use-action";
import { createCard } from "@/actions/create-card";
import { updateCard } from "@/actions/update-card";
import { setChecklistItemDueDate } from "@/actions/set-checklist-item-due-date";
import { Button } from "@/components/ui/button";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useRealtimeChannel } from "@/hooks/use-realtime-channel";
import { realtimeChannels } from "@/lib/realtime/channels";
import { isRealtimeClientConfigured } from "@/lib/realtime/client";
import { REALTIME_EVENTS } from "@/lib/realtime/events";
import { useBoardCalendarInvalidation } from "@/hooks/use-board-calendar-invalidation";
import { emptyBoardFilters, useBoardFilters } from "@/hooks/use-board-filters";
import {
  boardFiltersAreActive,
  calendarItemMatchesBoardFilters,
  unscheduledCardMatchesBoardFilters,
} from "@/lib/board-filters";
import {
  DAY_VIEW_SLOT_COUNT,
  DAY_VIEW_SLOT_HEIGHT,
  getDayViewDropDate,
  getDayViewSlotFromPointer,
} from "@/lib/calendar-day-view";
import {
  BOARD_CARD_CALENDAR_DRAG_MIME,
  type BoardCardCalendarDragPayload,
} from "@/lib/calendar-dnd";
import type {
  BoardCalendarCardItem,
  BoardCalendarChecklistItem,
  BoardCalendarItem,
  BoardCalendarResponse,
  BoardCalendarUnscheduledCard,
} from "@/types";

interface BoardCalendarViewProps {
  boardId: string;
  lists: BoardCalendarList[];
  currentBoardMemberId: string;
  defaultUnscheduledCollapsed?: boolean;
  variant?: "default" | "split";
}

type BoardCalendarList = {
  id: string;
  title: string;
  order: number;
};

type ViewMode = "month" | "week" | "day";
type CalendarOccurrenceKind = "single" | "start" | "due" | "range";

type CalendarOccurrence = {
  id: string;
  kind: CalendarOccurrenceKind;
  date: Date;
  item: BoardCalendarItem;
};

type CalendarRange = {
  id: string;
  item: BoardCalendarCardItem;
  startDate: Date;
  endDate: Date;
  startKey: string;
  endKey: string;
};

type CalendarRangeSegment = {
  id: string;
  range: CalendarRange;
  weekIndex: number;
  startIndex: number;
  endIndex: number;
  lane: number;
  isRangeStart: boolean;
  isRangeEnd: boolean;
};

type BoardCalendarRealtimePayload = {
  boardId: string;
};

type CalendarOccurrenceDragPayload = {
  kind: "calendar-occurrence";
  occurrenceId: string;
};

type UnscheduledCardDragPayload = {
  kind: "unscheduled-card";
  cardId: string;
  title: string;
  isCompleted: boolean;
};

type DayViewCardBlockDragPayload = {
  kind: "day-view-card-block";
  blockId: string;
};

type CalendarDragPayload =
  | CalendarOccurrenceDragPayload
  | UnscheduledCardDragPayload
  | DayViewCardBlockDragPayload
  | BoardCardCalendarDragPayload;

type CalendarResizeEdge = "start" | "end";

type CalendarResizeState = {
  edge: CalendarResizeEdge;
  pointerId: number;
  range: CalendarRange;
  targetDayKey: string;
};

type DayViewResizeState = {
  edge: CalendarResizeEdge;
  pointerId: number;
  block: PositionedDayViewBlock;
  targetMinute: number;
};

type CalendarMarkerListStyle = CSSProperties & {
  "--pt-desktop"?: string;
};

type DayViewBlock = {
  id: string;
  item: BoardCalendarItem;
  startsAt: Date;
  endsAt: Date;
  startMinute: number;
  endMinute: number;
  top: number;
  height: number;
};

type PositionedDayViewBlock = DayViewBlock & {
  lane: number;
  laneCount: number;
  isHiddenByLaneLimit: boolean;
  leftPercent: number;
  widthPercent: number;
};

type DayViewOverflowGroup = {
  id: string;
  startMinute: number;
  endMinute: number;
  top: number;
  height: number;
  hiddenBlocks: PositionedDayViewBlock[];
};

type DayViewBlockLayout = {
  visibleBlocks: PositionedDayViewBlock[];
  overflowGroups: DayViewOverflowGroup[];
};

type DayViewBlockStyle = CSSProperties & {
  "--day-block-left"?: string;
  "--day-block-width"?: string;
};

const WEEK_DAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
const DAY_VIEW_LABELS = ["Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy"];
const GMT7_OFFSET_MINUTES = 7 * 60;
const GMT7_OFFSET_MS = GMT7_OFFSET_MINUTES * 60 * 1000;
const MINUTES_IN_DAY = 24 * 60;
const MONTH_VISIBLE_DESKTOP = 3;
const MONTH_VISIBLE_MOBILE = 2;
const MONTH_RANGE_LANES = 2;
const WEEK_RANGE_LANES = 4;
const RANGE_LANE_HEIGHT = 28;
const RANGE_LANE_GAP = 4;
const WEEK_VISIBLE_DESKTOP = 8;
const WEEK_VISIBLE_MOBILE = 4;
const DAY_LANE_GAP_PX = 4;
const MAX_DAY_LANES = 4;
const MAX_MOBILE_DAY_LANES = 1;
const DAY_FLOATING_CARD_BLOCK_MINUTES = 30;
const DAY_TIME_SLOTS = Array.from({ length: 96 }, (_, index) => {
  const totalMinutes = index * 15;
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;

  return {
    index,
    hour,
    minute,
    label: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
    isHour: minute === 0,
  };
});
const DEFAULT_CREATE_HOUR = 9;
const DEFAULT_CREATE_TIME = `${String(DEFAULT_CREATE_HOUR).padStart(2, "0")}:00`;
const TIME_INPUT_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

const getMonthGridRange = (anchorDate: Date) => {
  const monthStart = startOfMonth(anchorDate);
  const from = startOfWeek(monthStart, { weekStartsOn: 1 });
  const monthEnd = new Date(anchorDate.getFullYear(), anchorDate.getMonth() + 1, 0);
  const to = endOfWeek(monthEnd, { weekStartsOn: 1 });

  return {
    fromIso: from.toISOString(),
    toIso: to.toISOString(),
    days: eachDayOfInterval({ start: from, end: to }),
  };
};

const getWeekGridRange = (anchorDate: Date) => {
  const from = startOfWeek(anchorDate, { weekStartsOn: 1 });
  const to = endOfWeek(anchorDate, { weekStartsOn: 1 });

  return {
    fromIso: from.toISOString(),
    toIso: to.toISOString(),
    days: eachDayOfInterval({ start: from, end: to }),
  };
};

const getGmt7Parts = (date: Date) => {
  const shiftedDate = new Date(date.getTime() + GMT7_OFFSET_MS);

  return {
    year: shiftedDate.getUTCFullYear(),
    month: shiftedDate.getUTCMonth(),
    date: shiftedDate.getUTCDate(),
    day: shiftedDate.getUTCDay(),
    hours: shiftedDate.getUTCHours(),
    minutes: shiftedDate.getUTCMinutes(),
  };
};

const getGmt7DayKey = (date: Date) => {
  const parts = getGmt7Parts(date);

  return [
    parts.year,
    String(parts.month + 1).padStart(2, "0"),
    String(parts.date).padStart(2, "0"),
  ].join("-");
};

const getGmt7DateFromParts = (
  year: number,
  month: number,
  date: number,
  hours = 0,
  minutes = 0,
  seconds = 0,
  milliseconds = 0,
) => new Date(
  Date.UTC(year, month, date, hours, minutes, seconds, milliseconds) -
    GMT7_OFFSET_MS,
);

const getDayGridRange = (anchorDate: Date) => {
  const { year, month, date } = getGmt7Parts(anchorDate);
  const from = getGmt7DateFromParts(year, month, date, 0, 0, 0, 0);
  const to = getGmt7DateFromParts(year, month, date, 23, 59, 59, 999);

  return {
    fromIso: from.toISOString(),
    toIso: to.toISOString(),
    days: [from],
  };
};

const getGmt7DayBoundary = (anchorDate: Date) => {
  const { year, month, date } = getGmt7Parts(anchorDate);
  const start = getGmt7DateFromParts(year, month, date, 0, 0, 0, 0);
  const end = getGmt7DateFromParts(year, month, date + 1, 0, 0, 0, 0);

  return { start, end };
};

const formatDayTitle = (date: Date) => {
  const parts = getGmt7Parts(date);

  return `${DAY_VIEW_LABELS[parts.day]}, ${String(parts.date).padStart(2, "0")}/${String(parts.month + 1).padStart(2, "0")}/${parts.year}`;
};

const getDayKey = (date: Date) => format(date, "yyyy-MM-dd");

const formatCalendarTime = (date: Date) => format(date, "HH:mm");

const formatCalendarDateTime = (date: Date) =>
  format(date, "dd/MM/yyyy HH:mm", { locale: vi });

const formatGmt7Time = (date: Date) => {
  const parts = getGmt7Parts(date);

  return `${String(parts.hours).padStart(2, "0")}:${String(parts.minutes).padStart(2, "0")}`;
};

const formatGmt7DateTime = (date: Date) => {
  const parts = getGmt7Parts(date);

  return [
    `${String(parts.date).padStart(2, "0")}/${String(parts.month + 1).padStart(2, "0")}/${parts.year}`,
    formatGmt7Time(date),
  ].join(" ");
};

const getLocalDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const compareDay = (left: Date, right: Date) =>
  getLocalDay(left).getTime() - getLocalDay(right).getTime();

const parseCalendarDate = (value: string | null) => {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
};

const parseDayViewItemDates = (item: BoardCalendarItem) => ({
  startDate: isCalendarCardItem(item) ? parseCalendarDate(item.startDate) : null,
  dueDate: parseCalendarDate(item.dueDate),
});

const isCalendarCardItem = (
  item: BoardCalendarItem,
): item is BoardCalendarCardItem => item.type === "card";

const isCalendarChecklistItem = (
  item: BoardCalendarItem,
): item is BoardCalendarChecklistItem => item.type === "checklist-item";

const getCalendarItemStartDate = (item: BoardCalendarItem) =>
  isCalendarCardItem(item) ? item.startDate : null;

const getCalendarItemDueDate = (item: BoardCalendarItem) => item.dueDate;

const getCalendarItemAssigneeCount = (item: BoardCalendarItem) =>
  isCalendarCardItem(item)
    ? item.assignees.length
    : item.assignee
      ? 1
      : 0;

const getCalendarItemCommentCount = (item: BoardCalendarItem) =>
  isCalendarCardItem(item) ? item.commentCount : 0;

const getCalendarItemTitle = (item: BoardCalendarItem) => {
  const startDate = parseCalendarDate(getCalendarItemStartDate(item));
  const dueDate = parseCalendarDate(getCalendarItemDueDate(item));
  const parts = [
    item.title,
    `Danh sách: ${item.listTitle}`,
  ];

  if (item.type === "checklist-item") {
    parts.splice(1, 0, `Thẻ: ${item.cardTitle}`);
    parts.splice(2, 0, `Danh sách kiểm tra: ${item.checklistTitle}`);
  }

  if (startDate) {
    parts.push(`Bắt đầu: ${formatCalendarDateTime(startDate)}`);
  }

  if (dueDate) {
    parts.push(`Kết thúc: ${formatCalendarDateTime(dueDate)}`);
  }

  if (item.isCompleted) {
    parts.push("Trạng thái: Hoàn thành");
  }

  if (item.type === "checklist-item" && item.assignee) {
    parts.push(`Phụ trách: ${item.assignee.userName}`);
  }

  return parts.join("\n");
};

const getOccurrenceTimeLabel = (occurrence: CalendarOccurrence) => {
  const startDate = parseCalendarDate(getCalendarItemStartDate(occurrence.item));
  const dueDate = parseCalendarDate(getCalendarItemDueDate(occurrence.item));

  if (startDate && dueDate && isSameDay(startDate, dueDate)) {
    const startTime = formatCalendarTime(startDate);
    const dueTime = formatCalendarTime(dueDate);

    return startTime === dueTime ? startTime : `${startTime}-${dueTime}`;
  }

  if (
    getCalendarItemStartDate(occurrence.item) &&
    !getCalendarItemDueDate(occurrence.item) &&
    startDate
  ) {
    return formatCalendarTime(startDate);
  }

  if (getCalendarItemDueDate(occurrence.item) && dueDate) {
    return formatCalendarTime(dueDate);
  }

  if (startDate) {
    return formatCalendarTime(startDate);
  }

  return null;
};

const getOccurrenceLabel = (occurrence: CalendarOccurrence) => {
  if (occurrence.item.type === "checklist-item") {
    return null;
  }

  if (occurrence.kind === "start") {
    return "Bắt đầu";
  }

  if (occurrence.kind === "due") {
    return "Kết thúc";
  }

  if (occurrence.kind === "range") {
    const start = parseCalendarDate(occurrence.item.startDate);
    const due = parseCalendarDate(occurrence.item.dueDate);

    if (start && due) {
      return `${format(start, "dd/MM")} - ${format(due, "dd/MM")}`;
    }

    return null;
  }

  // Handles occurrence.kind === "single"
  const start = parseCalendarDate(occurrence.item.startDate);
  const due = parseCalendarDate(occurrence.item.dueDate);

  if (start && !due) {
    return "Bắt đầu";
  }

  if (!start && due) {
    return "Kết thúc";
  }

  if (start && due) {
    return null;
  }

  return "Lịch";
};

const copyDateToDay = (sourceDate: Date, targetDay: Date) => {
  const nextDate = new Date(sourceDate);
  nextDate.setFullYear(
    targetDay.getFullYear(),
    targetDay.getMonth(),
    targetDay.getDate(),
  );

  return nextDate;
};

const getDateWithPreservedTime = (sourceDate: Date, targetDay: Date) =>
  new Date(
    targetDay.getFullYear(),
    targetDay.getMonth(),
    targetDay.getDate(),
    sourceDate.getHours(),
    sourceDate.getMinutes(),
    sourceDate.getSeconds(),
    sourceDate.getMilliseconds(),
  );

const getDefaultDueDateForDay = (day: Date, timeValue = DEFAULT_CREATE_TIME) => {
  const match = TIME_INPUT_PATTERN.exec(timeValue);
  const hours = match ? Number(match[1]) : DEFAULT_CREATE_HOUR;
  const minutes = match ? Number(match[2]) : 0;

  return new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    hours,
    minutes,
    0,
    0,
  );
};

const getReminderError = (dueDate: Date, reminder: string | null) => {
  if (!reminder || reminder === "none") {
    return null;
  }

  const offsetMinutes = parseInt(reminder, 10);

  if (Number.isNaN(offsetMinutes)) {
    return "Mốc nhắc nhở không hợp lệ.";
  }

  const triggerTime = dueDate.getTime() - offsetMinutes * 60_000;

  if (triggerTime >= Date.now()) {
    return null;
  }

  const minutesUntilDue = Math.floor((dueDate.getTime() - Date.now()) / 60_000);

  if (minutesUntilDue <= 0) {
    return "Thẻ đã hết hạn. Vui lòng kéo ngày hết hạn sang thời điểm hợp lệ.";
  }

  return "Thời gian nhắc nhở đã ở trong quá khứ. Hãy kéo ngày hết hạn xa hơn hoặc đổi mốc nhắc nhở.";
};

const isOverdue = (item: BoardCalendarItem) => {
  const dueDate = getCalendarItemDueDate(item);

  if (!dueDate || item.isCompleted) {
    return false;
  }

  return new Date(dueDate).getTime() < Date.now();
};

const getOccurrenceTone = (occurrence: CalendarOccurrence) => {
  if (occurrence.item.isCompleted) {
    return "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100";
  }

  if (isOverdue(occurrence.item) && occurrence.kind !== "start") {
    return "border-red-200 bg-red-50 text-red-800 hover:bg-red-100";
  }

  if (occurrence.item.type === "checklist-item") {
    return "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100";
  }

  if (occurrence.kind === "start") {
    return "border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100";
  }

  return "border-violet-200 bg-violet-50 text-violet-800 hover:bg-violet-100";
};

const getOccurrences = (items: BoardCalendarItem[]) =>
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

const getRanges = (items: BoardCalendarItem[]) =>
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

const getWeekRows = (days: Date[]) => {
  const rows: Date[][] = [];

  for (let index = 0; index < days.length; index += 7) {
    rows.push(days.slice(index, index + 7));
  }

  return rows;
};

const getRangeSegmentsForWeeks = (
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

const getRangeOccurrencesByDay = (ranges: CalendarRange[], days: Date[]) =>
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

const clampRangeToGmt7Day = (
  rangeStart: Date,
  rangeEnd: Date,
  anchorDate: Date,
) => {
  const { start: dayStart, end: dayEnd } = getGmt7DayBoundary(anchorDate);

  if (rangeEnd.getTime() <= rangeStart.getTime()) {
    return null;
  }

  if (
    rangeEnd.getTime() <= dayStart.getTime() ||
    rangeStart.getTime() >= dayEnd.getTime()
  ) {
    return null;
  }

  return {
    startsAt: new Date(Math.max(rangeStart.getTime(), dayStart.getTime())),
    endsAt: new Date(Math.min(rangeEnd.getTime(), dayEnd.getTime())),
    dayStart,
  };
};

const getMinutesFromGmt7DayStart = (date: Date, dayStart: Date) => {
  const minutes = (date.getTime() - dayStart.getTime()) / 60_000;

  return Math.max(0, Math.min(MINUTES_IN_DAY, minutes));
};

const getDayViewBlockPosition = (
  startsAt: Date,
  endsAt: Date,
  dayStart: Date,
) => {
  const startMinute = Math.floor(getMinutesFromGmt7DayStart(startsAt, dayStart));
  const actualEndMinute = Math.ceil(getMinutesFromGmt7DayStart(endsAt, dayStart));
  const endMinute = Math.min(
    MINUTES_IN_DAY,
    Math.max(actualEndMinute, startMinute + 15),
  );

  return {
    startMinute,
    endMinute,
    top: (startMinute / MINUTES_IN_DAY) * 100,
    height: ((endMinute - startMinute) / MINUTES_IN_DAY) * 100,
  };
};

const getDayViewBlocks = (
  items: BoardCalendarItem[],
  anchorDate: Date,
) =>
  items.reduce<DayViewBlock[]>((acc, item) => {
    const { startDate, dueDate } = parseDayViewItemDates(item);
    const durationMinutes = item.type === "checklist-item"
      ? 15
      : DAY_FLOATING_CARD_BLOCK_MINUTES;
    let rangeStart: Date | null = null;
    let rangeEnd: Date | null = null;

    if (item.type === "checklist-item") {
      rangeStart = dueDate
        ? new Date(dueDate.getTime() - durationMinutes * 60_000)
        : null;
      rangeEnd = dueDate;
    } else if (startDate && dueDate) {
      rangeStart = startDate;
      rangeEnd = dueDate;
    } else if (dueDate) {
      rangeStart = dueDate;
      rangeEnd = new Date(dueDate.getTime() + durationMinutes * 60_000);
    } else {
      rangeStart = startDate;
      rangeEnd = startDate
        ? new Date(startDate.getTime() + durationMinutes * 60_000)
        : null;
    }

    if (!rangeStart || !rangeEnd) {
      return acc;
    }

    const clippedRange = clampRangeToGmt7Day(rangeStart, rangeEnd, anchorDate);

    if (!clippedRange) {
      return acc;
    }

    const position = getDayViewBlockPosition(
      clippedRange.startsAt,
      clippedRange.endsAt,
      clippedRange.dayStart,
    );

    if (position.endMinute <= position.startMinute) {
      return acc;
    }

    acc.push({
      id: `${item.id}:day-block:${getGmt7DayKey(anchorDate)}`,
      item,
      startsAt: clippedRange.startsAt,
      endsAt: clippedRange.endsAt,
      ...position,
    });

    return acc;
  }, [])
    .sort((left, right) => (
      left.startMinute - right.startMinute ||
      right.endMinute - left.endMinute ||
      left.item.title.localeCompare(right.item.title, "vi")
    ));

const dayBlocksOverlap = (
  left: DayViewBlock,
  right: DayViewBlock,
) => left.startMinute < right.endMinute && left.endMinute > right.startMinute;

const sortDayViewBlocks = (blocks: DayViewBlock[]) =>
  [...blocks].sort((left, right) => (
    left.startMinute - right.startMinute ||
    left.endMinute - right.endMinute ||
    left.id.localeCompare(right.id)
  ));

const getPositionedClusterBlocks = (
  clusterBlocks: DayViewBlock[],
  maxLanes: number,
) => {
  const laneEnds: number[] = [];
  const assignedBlocks = clusterBlocks.map((block) => {
    const reusableLane = laneEnds.findIndex((endMinute) =>
      endMinute <= block.startMinute,
    );
    const lane = reusableLane >= 0 ? reusableLane : laneEnds.length;
    laneEnds[lane] = block.endMinute;

    return {
      block,
      lane,
    };
  });
  const laneCount = Math.max(1, laneEnds.length);
  const visibleLaneCount = Math.min(laneCount, maxLanes);

  return assignedBlocks.map<PositionedDayViewBlock>(({ block, lane }) => {
    const isHiddenByLaneLimit = lane >= maxLanes;
    const widthPercent = isHiddenByLaneLimit
      ? 0
      : 100 / visibleLaneCount;

    return {
      ...block,
      lane,
      laneCount,
      isHiddenByLaneLimit,
      leftPercent: isHiddenByLaneLimit ? 0 : lane * widthPercent,
      widthPercent,
    };
  });
};

const getDayViewOverflowGroup = (
  clusterBlocks: PositionedDayViewBlock[],
) => {
  const hiddenBlocks = clusterBlocks.filter((block) => block.isHiddenByLaneLimit);

  if (hiddenBlocks.length === 0) {
    return null;
  }

  const startMinute = Math.min(...clusterBlocks.map((block) => block.startMinute));
  const endMinute = Math.max(...clusterBlocks.map((block) => block.endMinute));

  return {
    id: `day-overflow:${startMinute}:${endMinute}:${hiddenBlocks.map((block) => block.id).join("|")}`,
    startMinute,
    endMinute,
    top: (startMinute / MINUTES_IN_DAY) * 100,
    height: ((endMinute - startMinute) / MINUTES_IN_DAY) * 100,
    hiddenBlocks,
  } satisfies DayViewOverflowGroup;
};

const getOverlappingDayBlockLayout = (
  blocks: DayViewBlock[],
  maxLanes: number,
): DayViewBlockLayout => {
  const sortedBlocks = sortDayViewBlocks(blocks);
  const visibleBlocks: PositionedDayViewBlock[] = [];
  const overflowGroups: DayViewOverflowGroup[] = [];
  let clusterBlocks: DayViewBlock[] = [];
  let clusterEndMinute = 0;

  const flushCluster = () => {
    if (clusterBlocks.length === 0) {
      return;
    }

    const positionedBlocks = getPositionedClusterBlocks(clusterBlocks, maxLanes);
    const overflowGroup = getDayViewOverflowGroup(positionedBlocks);

    visibleBlocks.push(
      ...positionedBlocks.filter((block) => !block.isHiddenByLaneLimit),
    );

    if (overflowGroup) {
      overflowGroups.push(overflowGroup);
    }

    clusterBlocks = [];
    clusterEndMinute = 0;
  };

  sortedBlocks.forEach((block) => {
    if (clusterBlocks.length === 0) {
      clusterBlocks = [block];
      clusterEndMinute = block.endMinute;
      return;
    }

    const overlapsCluster = block.startMinute < clusterEndMinute ||
      clusterBlocks.some((clusterBlock) => dayBlocksOverlap(block, clusterBlock));

    if (!overlapsCluster) {
      flushCluster();
      clusterBlocks = [block];
      clusterEndMinute = block.endMinute;
      return;
    }

    clusterBlocks.push(block);
    clusterEndMinute = Math.max(clusterEndMinute, block.endMinute);
  });

  flushCluster();

  return {
    visibleBlocks,
    overflowGroups,
  };
};

const getDayViewBlockStyle = (
  block: PositionedDayViewBlock,
): DayViewBlockStyle => {
  return {
    top: `${block.top}%`,
    height: `${block.height}%`,
    "--day-block-left": `calc(${block.leftPercent}% + ${DAY_LANE_GAP_PX / 2}px)`,
    "--day-block-width": `calc(${block.widthPercent}% - ${DAY_LANE_GAP_PX}px)`,
  };
};

const getDayViewBlockTimeLabel = (block: DayViewBlock) => {
  if (block.item.type === "checklist-item") {
    const dueDate = parseCalendarDate(block.item.dueDate);

    return dueDate ? formatGmt7Time(dueDate) : formatGmt7Time(block.endsAt);
  }

  const itemStartDate = parseCalendarDate(block.item.startDate);
  const itemDueDate = parseCalendarDate(block.item.dueDate);

  if (itemStartDate && !itemDueDate) {
    return `Bắt đầu ${formatGmt7Time(itemStartDate)}`;
  }

  if (!itemStartDate && itemDueDate) {
    return `Kết thúc ${formatGmt7Time(itemDueDate)}`;
  }

  const startTime = formatGmt7Time(block.startsAt);
  const endTime = block.endMinute >= MINUTES_IN_DAY
    ? "24:00"
    : formatGmt7Time(block.endsAt);

  return startTime === endTime ? startTime : `${startTime}-${endTime}`;
};

const getDayViewBlockContext = (block: DayViewBlock) =>
  block.item.type === "checklist-item"
    ? block.item.checklistTitle
    : block.item.listTitle;

const getDayViewBlockTooltip = (block: DayViewBlock) => {
  const { item } = block;
  const checklistDueDate = item.type === "checklist-item"
    ? parseCalendarDate(item.dueDate)
    : null;
  const parts = item.type === "checklist-item"
    ? [
        item.title,
        `Danh sách kiểm tra: ${item.checklistTitle}`,
        `Thẻ: ${item.cardTitle}`,
        `Kết thúc: ${formatGmt7DateTime(checklistDueDate ?? block.endsAt)} GMT+7`,
      ]
    : [
        item.title,
        `Danh sách: ${item.listTitle}`,
        item.startDate ? `Bắt đầu: ${formatGmt7DateTime(parseCalendarDate(item.startDate) ?? block.startsAt)} GMT+7` : null,
        item.dueDate ? `Kết thúc: ${formatGmt7DateTime(parseCalendarDate(item.dueDate) ?? block.endsAt)} GMT+7` : null,
      ];

  if (item.isCompleted) {
    parts.push("Trạng thái: Hoàn thành");
  }

  return parts.filter((part): part is string => !!part).join("\n");
};

const getDayViewBlockTone = (block: DayViewBlock) => {
  if (block.item.isCompleted) {
    return "border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100";
  }

  if (isOverdue(block.item)) {
    return "border-red-200 bg-red-50 text-red-900 hover:bg-red-100";
  }

  if (block.item.type === "checklist-item") {
    return "border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100";
  }

  return "border-violet-200 bg-violet-50 text-violet-900 hover:bg-violet-100";
};

export const BoardCalendarView = ({
  boardId,
  lists,
  currentBoardMemberId,
  defaultUnscheduledCollapsed = false,
  variant = "default",
}: BoardCalendarViewProps) => {
  const router = useRouter();
  const cardModal = useCardModal();
  const queryClient = useQueryClient();
  const invalidateBoardCalendar = useBoardCalendarInvalidation(boardId);
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [anchorDate, setAnchorDate] = useState(() => new Date());
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [expandedDayKey, setExpandedDayKey] = useState<string | null>(null);
  const [draggingOccurrenceId, setDraggingOccurrenceId] = useState<string | null>(null);
  const [draggingUnscheduledCardId, setDraggingUnscheduledCardId] = useState<string | null>(null);
  const [draggingBoardCardId, setDraggingBoardCardId] = useState<string | null>(null);
  const [draggingDayViewBlockId, setDraggingDayViewBlockId] = useState<string | null>(null);
  const [dragOverDayKey, setDragOverDayKey] = useState<string | null>(null);
  const [dragOverDaySlotIndex, setDragOverDaySlotIndex] = useState<number | null>(null);
  const [dragOverDayMinute, setDragOverDayMinute] = useState<number | null>(null);
  const [resizingRange, setResizingRange] = useState<CalendarResizeState | null>(null);
  const [resizingDayViewBlock, setResizingDayViewBlock] = useState<DayViewResizeState | null>(null);
  const [openDayOverflowGroupId, setOpenDayOverflowGroupId] = useState<string | null>(null);
  const [createDialogDay, setCreateDialogDay] = useState<Date | null>(null);
  const [createTitle, setCreateTitle] = useState("");
  const [createTime, setCreateTime] = useState(DEFAULT_CREATE_TIME);
  const [createListId, setCreateListId] = useState(() => lists[0]?.id ?? "");
  const [isUnscheduledCollapsed, setIsUnscheduledCollapsed] = useState(defaultUnscheduledCollapsed);
  const suppressClickRef = useRef(false);
  const updateSuccessToastRef = useRef<string | null>(null);
  const updatingChecklistItemCardIdRef = useRef<string | null>(null);
  const dayViewDragSlotOffsetRef = useRef(0);
  const filters = useBoardFilters((state) =>
    state.filtersByBoardId[boardId] ?? emptyBoardFilters,
  );
  const setSelectedLists = useBoardFilters((state) => state.setSelectedLists);
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

  const realtimeChannelName = realtimeChannels.board(boardId);
  const realtimeEnabled = isRealtimeClientConfigured();
  const handleCalendarRealtime = useCallback((payload: BoardCalendarRealtimePayload) => {
    if (payload.boardId !== boardId) {
      return;
    }

    invalidateBoardCalendar();
  }, [boardId, invalidateBoardCalendar]);

  useRealtimeChannel({
    channelName: realtimeChannelName,
    event: REALTIME_EVENTS.CARD_CREATED,
    onEvent: handleCalendarRealtime,
    enabled: realtimeEnabled,
  });
  useRealtimeChannel({
    channelName: realtimeChannelName,
    event: REALTIME_EVENTS.CARD_UPDATED,
    onEvent: handleCalendarRealtime,
    enabled: realtimeEnabled,
  });
  useRealtimeChannel({
    channelName: realtimeChannelName,
    event: REALTIME_EVENTS.CARD_DELETED,
    onEvent: handleCalendarRealtime,
    enabled: realtimeEnabled,
  });
  useRealtimeChannel({
    channelName: realtimeChannelName,
    event: REALTIME_EVENTS.CARD_MOVED,
    onEvent: handleCalendarRealtime,
    enabled: realtimeEnabled,
  });
  useRealtimeChannel({
    channelName: realtimeChannelName,
    event: REALTIME_EVENTS.CARD_REORDERED,
    onEvent: handleCalendarRealtime,
    enabled: realtimeEnabled,
  });
  useRealtimeChannel({
    channelName: realtimeChannelName,
    event: REALTIME_EVENTS.CARD_COMMENT_COUNT_UPDATED,
    onEvent: handleCalendarRealtime,
    enabled: realtimeEnabled,
  });
  useRealtimeChannel({
    channelName: realtimeChannelName,
    event: REALTIME_EVENTS.CARD_MEMBER_ASSIGNED,
    onEvent: handleCalendarRealtime,
    enabled: realtimeEnabled,
  });
  useRealtimeChannel({
    channelName: realtimeChannelName,
    event: REALTIME_EVENTS.CARD_MEMBER_UNASSIGNED,
    onEvent: handleCalendarRealtime,
    enabled: realtimeEnabled,
  });
  useRealtimeChannel({
    channelName: realtimeChannelName,
    event: REALTIME_EVENTS.CARD_LABEL_ATTACHED,
    onEvent: handleCalendarRealtime,
    enabled: realtimeEnabled,
  });
  useRealtimeChannel({
    channelName: realtimeChannelName,
    event: REALTIME_EVENTS.CARD_LABEL_DETACHED,
    onEvent: handleCalendarRealtime,
    enabled: realtimeEnabled,
  });
  useRealtimeChannel({
    channelName: realtimeChannelName,
    event: REALTIME_EVENTS.LABEL_UPDATED,
    onEvent: handleCalendarRealtime,
    enabled: realtimeEnabled,
  });
  useRealtimeChannel({
    channelName: realtimeChannelName,
    event: REALTIME_EVENTS.LABEL_DELETED,
    onEvent: handleCalendarRealtime,
    enabled: realtimeEnabled,
  });
  useRealtimeChannel({
    channelName: realtimeChannelName,
    event: REALTIME_EVENTS.LIST_UPDATED,
    onEvent: handleCalendarRealtime,
    enabled: realtimeEnabled,
  });
  useRealtimeChannel({
    channelName: realtimeChannelName,
    event: REALTIME_EVENTS.LIST_DELETED,
    onEvent: handleCalendarRealtime,
    enabled: realtimeEnabled,
  });
  useRealtimeChannel({
    channelName: realtimeChannelName,
    event: REALTIME_EVENTS.CHECKLIST_UPDATED,
    onEvent: handleCalendarRealtime,
    enabled: realtimeEnabled,
  });
  useRealtimeChannel({
    channelName: realtimeChannelName,
    event: REALTIME_EVENTS.CHECKLIST_DELETED,
    onEvent: handleCalendarRealtime,
    enabled: realtimeEnabled,
  });
  useRealtimeChannel({
    channelName: realtimeChannelName,
    event: REALTIME_EVENTS.CHECKLIST_ITEM_CREATED,
    onEvent: handleCalendarRealtime,
    enabled: realtimeEnabled,
  });
  useRealtimeChannel({
    channelName: realtimeChannelName,
    event: REALTIME_EVENTS.CHECKLIST_ITEM_UPDATED,
    onEvent: handleCalendarRealtime,
    enabled: realtimeEnabled,
  });
  useRealtimeChannel({
    channelName: realtimeChannelName,
    event: REALTIME_EVENTS.CHECKLIST_ITEM_DELETED,
    onEvent: handleCalendarRealtime,
    enabled: realtimeEnabled,
  });
  useRealtimeChannel({
    channelName: realtimeChannelName,
    event: REALTIME_EVENTS.CHECKLIST_ITEM_TOGGLED,
    onEvent: handleCalendarRealtime,
    enabled: realtimeEnabled,
  });
  useRealtimeChannel({
    channelName: realtimeChannelName,
    event: REALTIME_EVENTS.CHECKLIST_ITEM_ASSIGNEE_UPDATED,
    onEvent: handleCalendarRealtime,
    enabled: realtimeEnabled,
  });
  useRealtimeChannel({
    channelName: realtimeChannelName,
    event: REALTIME_EVENTS.CHECKLIST_ITEM_DUE_DATE_UPDATED,
    onEvent: handleCalendarRealtime,
    enabled: realtimeEnabled,
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

  useEffect(() => {
    let cancelled = false;

    queueMicrotask(() => {
      if (!cancelled) {
        setExpandedDayKey(null);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [filters]);
  useEffect(() => {
    let cancelled = false;

    queueMicrotask(() => {
      if (!cancelled) {
        setOpenDayOverflowGroupId(null);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [dayViewBlocks]);
  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setCurrentTime(new Date());
    }, 60_000);

    return () => window.clearInterval(intervalId);
  }, []);
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

  const expandedDayItems = expandedDayKey
    ? [
      ...(rangeOccurrencesByDay[expandedDayKey] ?? []),
      ...(occurrencesByDay[expandedDayKey] ?? []),
    ]
    : [];

  const monthLabel = format(anchorDate, "'Tháng' M, yyyy", { locale: vi });
  const weekLabel = `Tuần ${format(new Date(fromIso), "dd/MM/yyyy", { locale: vi })} - ${format(new Date(toIso), "dd/MM/yyyy", { locale: vi })}`;
  const dayLabel = formatDayTitle(anchorDate);
  const rangeLabel = `${format(new Date(fromIso), "dd/MM/yyyy", { locale: vi })} - ${format(new Date(toIso), "dd/MM/yyyy", { locale: vi })}`;
  const titleLabel = viewMode === "month"
    ? monthLabel
    : viewMode === "week"
      ? weekLabel
      : dayLabel;
  const previousLabel = viewMode === "month"
    ? "Tháng trước"
    : viewMode === "week"
      ? "Tuần trước"
      : "Ngày trước";
  const nextLabel = viewMode === "month"
    ? "Tháng sau"
    : viewMode === "week"
      ? "Tuần sau"
      : "Ngày sau";
  const currentMonth = startOfMonth(anchorDate);
  const maxVisibleDesktop = viewMode === "month" ? MONTH_VISIBLE_DESKTOP : WEEK_VISIBLE_DESKTOP;
  const maxVisibleMobile = viewMode === "month" ? MONTH_VISIBLE_MOBILE : WEEK_VISIBLE_MOBILE;
  const selectedCreateDayLabel = createDialogDay
    ? format(createDialogDay, "EEEE, dd/MM/yyyy", { locale: vi })
    : "";

  const { execute: executeUpdateCard, isLoading: isUpdatingCardDate } = useAction(updateCard, {
    onSuccess: (data) => {
      toast.success(updateSuccessToastRef.current ?? "Đã cập nhật ngày");
      updateSuccessToastRef.current = null;
      setExpandedDayKey(null);
      invalidateBoardCalendar();
      queryClient.invalidateQueries({ queryKey: ["card", data.id] });
      queryClient.invalidateQueries({ queryKey: ["card-logs", data.id] });
      router.refresh();
    },
    onError: (error) => {
      updateSuccessToastRef.current = null;
      toast.error(error);
      invalidateBoardCalendar();
      void query.refetch();
    },
    onComplete: () => {
      setDraggingOccurrenceId(null);
      setDraggingUnscheduledCardId(null);
      setDraggingBoardCardId(null);
      setDraggingDayViewBlockId(null);
      setDragOverDayKey(null);
      setDragOverDaySlotIndex(null);
      setDragOverDayMinute(null);
      resetRangeResize();
      resetDayViewBlockResize();
    },
  });

  const {
    execute: executeSetChecklistItemDueDate,
    isLoading: isUpdatingChecklistItemDueDate,
  } = useAction(setChecklistItemDueDate, {
    onSuccess: () => {
      const cardId = updatingChecklistItemCardIdRef.current;

      toast.success("Đã cập nhật ngày của mục checklist");
      setExpandedDayKey(null);
      invalidateBoardCalendar();

      if (cardId) {
        queryClient.invalidateQueries({ queryKey: ["card", cardId] });
        queryClient.invalidateQueries({ queryKey: ["card-logs", cardId] });
      }

      router.refresh();
    },
    onError: (error) => {
      toast.error(error);
      invalidateBoardCalendar();
    },
    onComplete: () => {
      updatingChecklistItemCardIdRef.current = null;
      handleOccurrenceDragEnd();
    },
  });

  const { execute: executeCreateCard, fieldErrors: createFieldErrors, isLoading: isCreatingCard } = useAction(createCard, {
    onSuccess: (data) => {
      toast.success(`Đã tạo thẻ "${data.title}"`);
      setCreateDialogDay(null);
      setCreateTitle("");
      setCreateTime(DEFAULT_CREATE_TIME);
      invalidateBoardCalendar();
      queryClient.invalidateQueries({ queryKey: ["card", data.id] });
      router.refresh();
      cardModal.onOpen(data.id);
    },
    onError: (error) => {
      toast.error(error);
      invalidateBoardCalendar();
    },
  });

  const goToPrevious = () => {
    setExpandedDayKey(null);
    setAnchorDate((value) => {
      if (viewMode === "month") {
        return subMonths(value, 1);
      }

      if (viewMode === "week") {
        return subWeeks(value, 1);
      }

      return subDays(value, 1);
    });
  };

  const goToNext = () => {
    setExpandedDayKey(null);
    setAnchorDate((value) => {
      if (viewMode === "month") {
        return addMonths(value, 1);
      }

      if (viewMode === "week") {
        return addWeeks(value, 1);
      }

      return addDays(value, 1);
    });
  };

  const goToToday = () => {
    setExpandedDayKey(null);
    setAnchorDate(new Date());
  };

  const changeViewMode = (mode: ViewMode) => {
    setExpandedDayKey(null);
    setViewMode(mode);
  };

  const openCreateDialog = (day: Date, event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();

    if (
      draggingOccurrenceId ||
      draggingUnscheduledCardId ||
      draggingBoardCardId ||
      draggingDayViewBlockId ||
      resizingRange ||
      resizingDayViewBlock ||
      isUpdatingCardDate ||
      isUpdatingChecklistItemDueDate ||
      lists.length === 0
    ) {
      return;
    }

    setExpandedDayKey(null);
    setCreateDialogDay(day);
    setCreateTitle("");
    setCreateTime(DEFAULT_CREATE_TIME);
    setCreateListId((value) => value || lists[0]?.id || "");
  };

  const closeCreateDialog = (open: boolean) => {
    if (open) {
      return;
    }

    setCreateDialogDay(null);
    setCreateTitle("");
    setCreateTime(DEFAULT_CREATE_TIME);
  };

  const submitCreateCard = () => {
    const title = createTitle.trim();

    if (!title || title.length < 3) {
      toast.error("Tiêu đề quá ngắn (tối thiểu 3 ký tự).");
      return;
    }

    if (!createListId) {
      toast.error("Vui lòng chọn danh sách đích.");
      return;
    }

    if (!createDialogDay) {
      toast.error("Không xác định được ngày tạo thẻ.");
      return;
    }

    if (!TIME_INPUT_PATTERN.test(createTime)) {
      toast.error("Giờ hết hạn không hợp lệ.");
      return;
    }

    executeCreateCard({
      title,
      boardId,
      listId: createListId,
      dueDate: getDefaultDueDateForDay(createDialogDay, createTime),
    });
  };

  const openCalendarCard = useCallback((
    cardId: string,
    event?: MouseEvent<HTMLElement>,
    options?: { checklistItemId?: string },
  ) => {
    event?.stopPropagation();
    if (suppressClickRef.current) {
      return;
    }

    setExpandedDayKey(null);
    cardModal.onOpen(cardId, options);
  }, [cardModal]);

  const canClearStartDate = (occurrence: CalendarOccurrence) => (
    isCalendarCardItem(occurrence.item) &&
    (
      occurrence.kind === "start" ||
      occurrence.kind === "range" ||
      (occurrence.kind === "single" && !!occurrence.item.startDate)
    )
  );

  const canClearDueDate = (occurrence: CalendarOccurrence) => (
    isCalendarCardItem(occurrence.item) &&
    (
      occurrence.kind === "due" ||
      occurrence.kind === "range" ||
      (occurrence.kind === "single" && !!occurrence.item.dueDate)
    )
  );

  const toggleCalendarCardComplete = (occurrence: CalendarOccurrence) => {
    if (!isCalendarCardItem(occurrence.item)) {
      return;
    }

    updateSuccessToastRef.current = occurrence.item.isCompleted
      ? "Đã bỏ hoàn thành"
      : "Đã đánh dấu hoàn thành";

    executeUpdateCard({
      id: occurrence.item.cardId,
      boardId,
      isCompleted: !occurrence.item.isCompleted,
    });
  };

  const clearCalendarStartDate = (occurrence: CalendarOccurrence) => {
    if (!isCalendarCardItem(occurrence.item)) {
      return;
    }

    updateSuccessToastRef.current = "Đã xóa ngày bắt đầu";

    executeUpdateCard({
      id: occurrence.item.cardId,
      boardId,
      startDate: null,
    });
  };

  const clearCalendarDueDate = (occurrence: CalendarOccurrence) => {
    if (!isCalendarCardItem(occurrence.item)) {
      return;
    }

    updateSuccessToastRef.current = "Đã xóa ngày hết hạn";

    executeUpdateCard({
      id: occurrence.item.cardId,
      boardId,
      dueDate: null,
      reminder: null,
      isCompleted: false,
    });
  };

  const handleQuickActionClick = (
    event: MouseEvent<HTMLButtonElement>,
    action: () => void,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    suppressClickRef.current = true;
    action();
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);
  };

  const resetCalendarDragState = () => {
    setDraggingOccurrenceId(null);
    setDraggingUnscheduledCardId(null);
    setDraggingBoardCardId(null);
    setDraggingDayViewBlockId(null);
    setResizingDayViewBlock(null);
    setDragOverDayKey(null);
    setDragOverDaySlotIndex(null);
    setDragOverDayMinute(null);
    dayViewDragSlotOffsetRef.current = 0;
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);
  };

  const resetDayViewBlockResize = () => {
    setResizingDayViewBlock(null);
    setDragOverDayKey(null);
    setDragOverDaySlotIndex(null);
    setDragOverDayMinute(null);
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);
  };

  const handleOccurrenceDragStart = (
    event: DragEvent<HTMLDivElement>,
    occurrence: CalendarOccurrence,
  ) => {
    if (
      isUpdatingCardDate ||
      isUpdatingChecklistItemDueDate ||
      occurrence.kind === "range" ||
      (!isCalendarCardItem(occurrence.item) && !isCalendarChecklistItem(occurrence.item))
    ) {
      event.preventDefault();
      return;
    }

    const payload: CalendarDragPayload = {
      kind: "calendar-occurrence",
      occurrenceId: occurrence.id,
    };

    suppressClickRef.current = true;
    setDraggingOccurrenceId(occurrence.id);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("application/json", JSON.stringify(payload));
    event.dataTransfer.setData("text/plain", occurrence.id);
  };

  const handleOccurrenceDragEnd = () => {
    resetCalendarDragState();
  };

  const handleUnscheduledCardDragStart = (
    event: DragEvent<HTMLButtonElement>,
    card: BoardCalendarUnscheduledCard,
  ) => {
    if (isUpdatingCardDate || isUpdatingChecklistItemDueDate) {
      event.preventDefault();
      return;
    }

    const payload: CalendarDragPayload = {
      kind: "unscheduled-card",
      cardId: card.cardId,
      title: card.title,
      isCompleted: card.isCompleted,
    };

    suppressClickRef.current = true;
    setDraggingUnscheduledCardId(card.cardId);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("application/json", JSON.stringify(payload));
    event.dataTransfer.setData("text/plain", card.cardId);
  };

  const handleUnscheduledCardDragEnd = () => {
    resetCalendarDragState();
  };

  const getDraggedOccurrence = (event: DragEvent<HTMLElement>) => {
    const payloadValue = event.dataTransfer.getData("application/json");

    if (payloadValue) {
      try {
        const payload = JSON.parse(payloadValue) as Partial<CalendarDragPayload>;

        if (
          (!payload.kind || payload.kind === "calendar-occurrence") &&
          "occurrenceId" in payload &&
          payload.occurrenceId
        ) {
          return occurrencesById[payload.occurrenceId] ?? null;
        }
      } catch {
        return null;
      }
    }

    const fallbackId = event.dataTransfer.getData("text/plain");

    return fallbackId ? occurrencesById[fallbackId] ?? null : null;
  };

  const getDraggedUnscheduledCard = (event: DragEvent<HTMLElement>) => {
    const payloadValue = event.dataTransfer.getData("application/json");

    if (!payloadValue) {
      return null;
    }

    try {
      const payload = JSON.parse(payloadValue) as Partial<CalendarDragPayload>;

      if (
        payload.kind !== "unscheduled-card" ||
        !("cardId" in payload) ||
        !payload.cardId
      ) {
        return null;
      }

      return {
        cardId: payload.cardId,
        title: "title" in payload && payload.title ? payload.title : "",
        isCompleted:
          "isCompleted" in payload && typeof payload.isCompleted === "boolean"
            ? payload.isCompleted
            : false,
      };
    } catch {
      return null;
    }
  };

  const getDraggedBoardCard = (event: DragEvent<HTMLElement>) => {
    const payloadValue =
      event.dataTransfer.getData(BOARD_CARD_CALENDAR_DRAG_MIME) ||
      event.dataTransfer.getData("application/json");

    if (!payloadValue) {
      return null;
    }

    try {
      const payload = JSON.parse(payloadValue) as Partial<BoardCardCalendarDragPayload>;

      if (
        payload.kind !== "board-card" ||
        !("cardId" in payload) ||
        !payload.cardId ||
        ("boardId" in payload && payload.boardId !== boardId)
      ) {
        return null;
      }

      return {
        cardId: payload.cardId,
        title: "title" in payload && payload.title ? payload.title : "",
        isCompleted:
          "isCompleted" in payload && typeof payload.isCompleted === "boolean"
            ? payload.isCompleted
            : false,
      };
    } catch {
      return null;
    }
  };

  const getDraggedDayViewCardBlock = (event: DragEvent<HTMLElement>) => {
    const payloadValue = event.dataTransfer.getData("application/json");

    if (!payloadValue) {
      return draggingDayViewBlockId ? dayViewBlocksById[draggingDayViewBlockId] ?? null : null;
    }

    try {
      const payload = JSON.parse(payloadValue) as Partial<CalendarDragPayload>;

      if (
        payload.kind !== "day-view-card-block" ||
        !("blockId" in payload) ||
        !payload.blockId
      ) {
        return null;
      }

      return dayViewBlocksById[payload.blockId] ?? null;
    } catch {
      return null;
    }
  };

  const moveDayViewCardBlock = (
    block: DayViewBlock,
    targetDate: Date,
  ) => {
    if (isCalendarChecklistItem(block.item)) {
      const currentDueDate = parseCalendarDate(block.item.dueDate);
      const nextDueDate = new Date(targetDate.getTime() + 15 * 60_000);

      if (currentDueDate?.getTime() === nextDueDate.getTime()) {
        resetCalendarDragState();
        return;
      }

      updatingChecklistItemCardIdRef.current = block.item.cardId;
      executeSetChecklistItemDueDate({
        boardId,
        cardId: block.item.cardId,
        id: block.item.checklistItemId,
        dueDate: nextDueDate,
      });
      return;
    }

    if (!isCalendarCardItem(block.item)) {
      toast.error("Chỉ hỗ trợ di chuyển thẻ trong Day View.");
      resetCalendarDragState();
      return;
    }

    const currentStartDate = parseCalendarDate(block.item.startDate);
    const currentDueDate = parseCalendarDate(block.item.dueDate);

    if (!currentStartDate && !currentDueDate) {
      toast.error("Thẻ chưa có thời gian để di chuyển trong Day View.");
      resetCalendarDragState();
      return;
    }

    if (currentStartDate && currentDueDate) {
      const durationMs = currentDueDate.getTime() - currentStartDate.getTime();

      if (durationMs <= 0) {
        toast.error("Khoảng thời gian của thẻ không hợp lệ.");
        resetCalendarDragState();
        return;
      }

      const nextDueDate = new Date(targetDate.getTime() + durationMs);

      if (
        currentStartDate.getTime() === targetDate.getTime() &&
        currentDueDate.getTime() === nextDueDate.getTime()
      ) {
        resetCalendarDragState();
        return;
      }

      updateSuccessToastRef.current = "Đã di chuyển thẻ";

      executeUpdateCard({
        id: block.item.cardId,
        boardId,
        startDate: targetDate,
        dueDate: nextDueDate,
        dueDateTimezoneOffset: -GMT7_OFFSET_MINUTES,
        isCompleted: block.item.isCompleted,
        ...(block.item.reminder !== null ? { reminder: block.item.reminder } : {}),
      });
      return;
    }

    if (currentStartDate) {
      if (currentStartDate.getTime() === targetDate.getTime()) {
        resetCalendarDragState();
        return;
      }

      updateSuccessToastRef.current = "Đã di chuyển thẻ";

      executeUpdateCard({
        id: block.item.cardId,
        boardId,
        startDate: targetDate,
        dueDateTimezoneOffset: -GMT7_OFFSET_MINUTES,
      });
      return;
    }

    if (currentDueDate) {
      if (currentDueDate.getTime() === targetDate.getTime()) {
        resetCalendarDragState();
        return;
      }

      updateSuccessToastRef.current = "Đã di chuyển thẻ";

      executeUpdateCard({
        id: block.item.cardId,
        boardId,
        dueDate: targetDate,
        dueDateTimezoneOffset: -GMT7_OFFSET_MINUTES,
        isCompleted: block.item.isCompleted,
        ...(block.item.reminder !== null ? { reminder: block.item.reminder } : {}),
      });
    }
  };

  const updateOccurrenceDate = (occurrence: CalendarOccurrence, targetDay: Date) => {
    const { item } = occurrence;

    if (!isCalendarCardItem(item) && !isCalendarChecklistItem(item)) {
      toast.error("Không thể cập nhật mục lịch này.");
      handleOccurrenceDragEnd();
      return;
    }

    const currentStartDate = isCalendarCardItem(item)
      ? parseCalendarDate(item.startDate)
      : null;
    const currentDueDate = parseCalendarDate(item.dueDate);
    const targetDayKey = getDayKey(targetDay);
    const sourceDayKey = getDayKey(occurrence.date);

    if (targetDayKey === sourceDayKey) {
      handleOccurrenceDragEnd();
      return;
    }

    if (isCalendarChecklistItem(item)) {
      const nextDueDate = currentDueDate
        ? copyDateToDay(currentDueDate, targetDay)
        : getDefaultDueDateForDay(targetDay);

      updatingChecklistItemCardIdRef.current = item.cardId;
      executeSetChecklistItemDueDate({
        boardId,
        cardId: item.cardId,
        id: item.checklistItemId,
        dueDate: nextDueDate,
      });
      return;
    }

    let nextStartDate: Date | undefined;
    let nextDueDate: Date | undefined;
    let shouldUpdateDueDate = false;

    if (occurrence.kind === "start") {
      if (!currentStartDate) {
        toast.error("Không tìm thấy ngày bắt đầu của thẻ.");
        handleOccurrenceDragEnd();
        return;
      }

      nextStartDate = copyDateToDay(currentStartDate, targetDay);
    } else if (occurrence.kind === "due") {
      if (!currentDueDate) {
        toast.error("Không tìm thấy ngày hết hạn của thẻ.");
        handleOccurrenceDragEnd();
        return;
      }

      nextDueDate = copyDateToDay(currentDueDate, targetDay);
      shouldUpdateDueDate = true;
    } else if (currentStartDate && currentDueDate && isSameDay(currentStartDate, currentDueDate)) {
      nextStartDate = copyDateToDay(currentStartDate, targetDay);
      nextDueDate = copyDateToDay(currentDueDate, targetDay);
      shouldUpdateDueDate = true;
    } else if (currentDueDate) {
      nextDueDate = copyDateToDay(currentDueDate, targetDay);
      shouldUpdateDueDate = true;
    } else if (currentStartDate) {
      nextStartDate = copyDateToDay(currentStartDate, targetDay);
    } else {
      toast.error("Không tìm thấy ngày của thẻ.");
      handleOccurrenceDragEnd();
      return;
    }

    const effectiveStartDate = nextStartDate ?? currentStartDate;
    const effectiveDueDate = nextDueDate ?? currentDueDate;

    if (
      effectiveStartDate &&
      effectiveDueDate &&
      effectiveStartDate.getTime() > effectiveDueDate.getTime()
    ) {
      toast.error("Ngày bắt đầu phải trước hoặc bằng ngày hết hạn.");
      invalidateBoardCalendar();
      handleOccurrenceDragEnd();
      return;
    }

    if (nextDueDate) {
      const reminderError = getReminderError(nextDueDate, item.reminder);

      if (reminderError) {
        toast.error(reminderError);
        invalidateBoardCalendar();
        handleOccurrenceDragEnd();
        return;
      }
    }

    updateSuccessToastRef.current = "Đã cập nhật ngày";

    executeUpdateCard({
      id: item.cardId,
      boardId,
      ...(nextStartDate !== undefined ? { startDate: nextStartDate } : {}),
      ...(nextDueDate !== undefined ? { dueDate: nextDueDate } : {}),
      dueDateTimezoneOffset: nextDueDate
        ? getDateTimezoneOffset(nextDueDate)
        : nextStartDate
          ? getDateTimezoneOffset(nextStartDate)
          : undefined,
      ...(shouldUpdateDueDate ? { isCompleted: item.isCompleted } : {}),
      ...(shouldUpdateDueDate && item.reminder !== null ? { reminder: item.reminder } : {}),
    });
  };

  const scheduleUnscheduledCard = (
    card: Pick<UnscheduledCardDragPayload, "cardId" | "isCompleted">,
    targetDay: Date,
  ) => {
    const dueDate = getDefaultDueDateForDay(targetDay);

    updateSuccessToastRef.current = "Đã lên lịch thẻ";

    executeUpdateCard({
      id: card.cardId,
      boardId,
      dueDate,
      dueDateTimezoneOffset: getDateTimezoneOffset(dueDate),
      isCompleted: card.isCompleted,
    });
  };

  const scheduleUnscheduledCardAtDate = (
    card: Pick<UnscheduledCardDragPayload, "cardId" | "isCompleted">,
    startDate: Date,
  ) => {
    const dueDate = new Date(startDate.getTime() + 60 * 60 * 1000);

    updateSuccessToastRef.current = "Đã lên lịch thẻ";

    executeUpdateCard({
      id: card.cardId,
      boardId,
      startDate,
      dueDate,
      dueDateTimezoneOffset: -GMT7_OFFSET_MINUTES,
      isCompleted: card.isCompleted,
    });
  };

  const scheduleBoardCard = (
    card: Pick<BoardCardCalendarDragPayload, "cardId" | "isCompleted">,
    targetDay: Date,
  ) => {
    const dueDate = getDefaultDueDateForDay(targetDay);

    updateSuccessToastRef.current = "Đã lên lịch thẻ";

    executeUpdateCard({
      id: card.cardId,
      boardId,
      dueDate,
      dueDateTimezoneOffset: getDateTimezoneOffset(dueDate),
      isCompleted: card.isCompleted,
    });
  };

  const scheduleBoardCardAtDate = (
    card: Pick<BoardCardCalendarDragPayload, "cardId" | "isCompleted">,
    startDate: Date,
  ) => {
    const dueDate = new Date(startDate.getTime() + 60 * 60 * 1000);

    updateSuccessToastRef.current = "Đã lên lịch thẻ";

    executeUpdateCard({
      id: card.cardId,
      boardId,
      startDate,
      dueDate,
      dueDateTimezoneOffset: -GMT7_OFFSET_MINUTES,
      isCompleted: card.isCompleted,
    });
  };

  const handleDayViewBlockDragStart = (
    event: DragEvent<HTMLElement>,
    block: PositionedDayViewBlock,
  ) => {
    if (
      isUpdatingCardDate ||
      isUpdatingChecklistItemDueDate ||
      (
        !isCalendarCardItem(block.item) &&
        !isCalendarChecklistItem(block.item)
      ) ||
      (
        isCalendarCardItem(block.item) &&
        !block.item.startDate &&
        !block.item.dueDate
      ) ||
      (
        isCalendarChecklistItem(block.item) &&
        !block.item.dueDate
      )
    ) {
      event.preventDefault();
      return;
    }

    const blockRect = event.currentTarget.getBoundingClientRect();
    const blockSlotCount = Math.max(
      1,
      Math.round((block.endMinute - block.startMinute) / 15),
    );
    const grabbedSlotOffset = Math.floor(
      (event.clientY - blockRect.top) / DAY_VIEW_SLOT_HEIGHT,
    );

    dayViewDragSlotOffsetRef.current = Math.min(
      Math.max(grabbedSlotOffset, 0),
      blockSlotCount - 1,
    );

    const payload: CalendarDragPayload = {
      kind: "day-view-card-block",
      blockId: block.id,
    };

    suppressClickRef.current = true;
    setExpandedDayKey(null);
    setDraggingDayViewBlockId(block.id);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("application/json", JSON.stringify(payload));
    event.dataTransfer.setData("text/plain", block.item.cardId);
  };

  const handleDayViewBlockDragEnd = () => {
    resetCalendarDragState();
  };

  const getDayViewTargetSlotIndex = (
    event: DragEvent<HTMLDivElement>,
    gridElement: HTMLDivElement,
  ) => {
    const pointerSlotIndex = getDayViewSlotFromPointer(event, gridElement);
    const slotOffset = draggingDayViewBlockId
      ? dayViewDragSlotOffsetRef.current
      : 0;

    return Math.min(
      Math.max(pointerSlotIndex - slotOffset, 0),
      DAY_VIEW_SLOT_COUNT - 1,
    );
  };

  const handleDayDragOver = (event: DragEvent<HTMLDivElement>, dayKey: string) => {
    const dragTypes = Array.from(event.dataTransfer.types);
    const hasBoardCardPayload =
      dragTypes.includes(BOARD_CARD_CALENDAR_DRAG_MIME) ||
      dragTypes.includes("application/json");

    if (!draggingOccurrenceId && !draggingUnscheduledCardId && !hasBoardCardPayload) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (hasBoardCardPayload) {
      const fallbackId = event.dataTransfer.getData("text/plain");
      setDraggingBoardCardId(fallbackId || "external");
    }
    setDragOverDayKey(dayKey);
  };

  const handleDayDrop = (event: DragEvent<HTMLDivElement>, day: Date) => {
    event.preventDefault();
    event.stopPropagation();
    suppressClickRef.current = true;

    const unscheduledCard = getDraggedUnscheduledCard(event);

    if (unscheduledCard) {
      scheduleUnscheduledCard(unscheduledCard, day);
      return;
    }

    const boardCard = getDraggedBoardCard(event);

    if (boardCard) {
      scheduleBoardCard(boardCard, day);
      return;
    }

    const occurrence = getDraggedOccurrence(event);

    if (!occurrence) {
      toast.error("Không thể xác định mục lịch đang kéo.");
      invalidateBoardCalendar();
      resetCalendarDragState();
      return;
    }

    updateOccurrenceDate(occurrence, day);
  };

  const handleDayViewDragOver = (event: DragEvent<HTMLDivElement>) => {
    const dragTypes = Array.from(event.dataTransfer.types);
    const hasBoardCardPayload =
      dragTypes.includes(BOARD_CARD_CALENDAR_DRAG_MIME) ||
      (
        dragTypes.includes("application/json") &&
        !draggingOccurrenceId &&
        !draggingUnscheduledCardId &&
        !draggingDayViewBlockId
      );

    if (!draggingUnscheduledCardId && !draggingDayViewBlockId && !hasBoardCardPayload) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";

    const slotIndex = getDayViewTargetSlotIndex(event, event.currentTarget);
    setDragOverDayKey(getGmt7DayKey(anchorDate));
    setDragOverDaySlotIndex(slotIndex);
    setDragOverDayMinute(null);

    if (hasBoardCardPayload) {
      const fallbackId = event.dataTransfer.getData("text/plain");
      setDraggingBoardCardId(fallbackId || "external");
    }
  };

  const handleDayViewDragLeave = (event: DragEvent<HTMLDivElement>) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
      return;
    }

    setDragOverDaySlotIndex(null);
    setDragOverDayMinute(null);
  };

  const handleDayViewDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    suppressClickRef.current = true;

    const slotIndex = getDayViewTargetSlotIndex(event, event.currentTarget);
    const startDate = getDayViewDropDate(anchorDate, slotIndex);
    const unscheduledCard = getDraggedUnscheduledCard(event);

    if (unscheduledCard) {
      scheduleUnscheduledCardAtDate(unscheduledCard, startDate);
      return;
    }

    const boardCard = getDraggedBoardCard(event);

    if (boardCard) {
      scheduleBoardCardAtDate(boardCard, startDate);
      return;
    }

    const dayViewBlock = getDraggedDayViewCardBlock(event);

    if (dayViewBlock) {
      moveDayViewCardBlock(dayViewBlock, startDate);
      return;
    }

    toast.error("Không thể xác định thẻ đang kéo.");
    invalidateBoardCalendar();
    resetCalendarDragState();
  };

  const getDayViewResizeMinute = (
    event: PointerEvent<HTMLElement>,
    handleElement: HTMLElement,
  ) => {
    const gridElement = handleElement.closest<HTMLElement>("[data-calendar-day-view-grid]");

    if (!gridElement) {
      return null;
    }

    const rect = gridElement.getBoundingClientRect();
    const rawMinute =
      ((event.clientY - rect.top) / DAY_VIEW_SLOT_HEIGHT) * 15;

    return Math.min(
      Math.max(Math.round(rawMinute), 0),
      MINUTES_IN_DAY,
    );
  };

  const getDayViewDateAtMinute = (minute: number) => {
    const { start } = getGmt7DayBoundary(anchorDate);

    return new Date(start.getTime() + minute * 60_000);
  };

  const handleDayViewBlockResizeStart = (
    event: PointerEvent<HTMLSpanElement>,
    block: PositionedDayViewBlock,
    edge: CalendarResizeEdge,
  ) => {
    const canResize =
      block.item.type === "card" &&
      !!block.item.startDate &&
      !!block.item.dueDate &&
      !isUpdatingCardDate &&
      !isUpdatingChecklistItemDueDate;

    if (!canResize || event.pointerType === "touch") {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    const targetMinute = getDayViewResizeMinute(event, event.currentTarget);

    if (targetMinute === null) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    suppressClickRef.current = true;
    setExpandedDayKey(null);
    setDragOverDayKey(getGmt7DayKey(anchorDate));
    setDragOverDaySlotIndex(null);
    setDragOverDayMinute(targetMinute);
    setResizingDayViewBlock({
      edge,
      pointerId: event.pointerId,
      block,
      targetMinute,
    });
  };

  const handleDayViewBlockResizeMove = (
    event: PointerEvent<HTMLSpanElement>,
  ) => {
    if (
      !resizingDayViewBlock ||
      resizingDayViewBlock.pointerId !== event.pointerId
    ) {
      return;
    }

    const targetMinute = getDayViewResizeMinute(event, event.currentTarget);

    if (targetMinute === null) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    setDragOverDayKey(getGmt7DayKey(anchorDate));
    setDragOverDaySlotIndex(null);
    setDragOverDayMinute(targetMinute);
    setResizingDayViewBlock((value) => value
      ? {
        ...value,
        targetMinute,
      }
      : value);
  };

  const failDayViewBlockResize = (message: string) => {
    toast.error(message);
    invalidateBoardCalendar();
    void query.refetch();
    resetDayViewBlockResize();
  };

  const commitDayViewBlockResize = (
    block: PositionedDayViewBlock,
    edge: CalendarResizeEdge,
    targetMinute: number,
  ) => {
    if (!isCalendarCardItem(block.item)) {
      failDayViewBlockResize("Checklist item chưa hỗ trợ resize trong Day View.");
      return;
    }

    const currentStartDate = parseCalendarDate(block.item.startDate);
    const currentDueDate = parseCalendarDate(block.item.dueDate);

    if (!currentStartDate || !currentDueDate) {
      failDayViewBlockResize("Chỉ thẻ có cả ngày bắt đầu và hết hạn mới resize được.");
      return;
    }

    const targetDate = getDayViewDateAtMinute(targetMinute);

    if (edge === "start") {
      if (targetDate.getTime() === currentStartDate.getTime()) {
        resetDayViewBlockResize();
        return;
      }

      const nextDurationMs = currentDueDate.getTime() - targetDate.getTime();

      if (targetDate.getTime() >= currentDueDate.getTime() || nextDurationMs < 15 * 60_000) {
        failDayViewBlockResize("Khoảng thời gian tối thiểu là 15 phút.");
        return;
      }

      updateSuccessToastRef.current = "Đã resize thẻ";
      executeUpdateCard({
        id: block.item.cardId,
        boardId,
        startDate: targetDate,
        dueDateTimezoneOffset: -GMT7_OFFSET_MINUTES,
      });
      return;
    }

    if (targetDate.getTime() === currentDueDate.getTime()) {
      resetDayViewBlockResize();
      return;
    }

    const nextDurationMs = targetDate.getTime() - currentStartDate.getTime();

    if (targetDate.getTime() <= currentStartDate.getTime() || nextDurationMs < 15 * 60_000) {
      failDayViewBlockResize("Khoảng thời gian tối thiểu là 15 phút.");
      return;
    }

    const reminderError = getReminderError(targetDate, block.item.reminder);

    if (reminderError) {
      failDayViewBlockResize(reminderError);
      return;
    }

    updateSuccessToastRef.current = "Đã resize thẻ";
    executeUpdateCard({
      id: block.item.cardId,
      boardId,
      dueDate: targetDate,
      dueDateTimezoneOffset: -GMT7_OFFSET_MINUTES,
      isCompleted: block.item.isCompleted,
      ...(block.item.reminder !== null ? { reminder: block.item.reminder } : {}),
    });
  };

  const handleDayViewBlockResizeEnd = (
    event: PointerEvent<HTMLSpanElement>,
  ) => {
    if (
      !resizingDayViewBlock ||
      resizingDayViewBlock.pointerId !== event.pointerId
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    commitDayViewBlockResize(
      resizingDayViewBlock.block,
      resizingDayViewBlock.edge,
      resizingDayViewBlock.targetMinute,
    );
  };

  const getResizeTargetDayKey = (event: PointerEvent<HTMLElement>) => {
    const element = document.elementFromPoint(event.clientX, event.clientY);
    const dayElement = element?.closest<HTMLElement>("[data-calendar-day-key]");

    return dayElement?.dataset.calendarDayKey ?? null;
  };

  const resetRangeResize = () => {
    setResizingRange(null);
    setDragOverDayKey(null);
    setDragOverDaySlotIndex(null);
    setDragOverDayMinute(null);
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);
  };

  const handleRangeResizeStart = (
    event: PointerEvent<HTMLButtonElement>,
    range: CalendarRange,
    edge: CalendarResizeEdge,
  ) => {
    if (isUpdatingCardDate || event.pointerType === "touch") {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    suppressClickRef.current = true;
    setExpandedDayKey(null);
    const targetDayKey = edge === "start" ? range.startKey : range.endKey;
    setDragOverDayKey(targetDayKey);
    setResizingRange({
      edge,
      pointerId: event.pointerId,
      range,
      targetDayKey,
    });
  };

  const handleRangeResizeMove = (event: PointerEvent<HTMLButtonElement>) => {
    if (!resizingRange || resizingRange.pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const targetDayKey = getResizeTargetDayKey(event);

    if (!targetDayKey || !daysByKey[targetDayKey]) {
      return;
    }

    setDragOverDayKey(targetDayKey);
    setResizingRange((value) => value
      ? {
        ...value,
        targetDayKey,
      }
      : value);
  };

  const commitRangeResize = (
    range: CalendarRange,
    edge: CalendarResizeEdge,
    targetDay: Date,
  ) => {
    const startDate = parseCalendarDate(range.item.startDate);
    const dueDate = parseCalendarDate(range.item.dueDate);

    if (!startDate || !dueDate) {
      toast.error("Không tìm thấy khoảng thời gian của thẻ.");
      resetRangeResize();
      return;
    }

    if (edge === "start") {
      const nextStartDate = getDateWithPreservedTime(startDate, targetDay);

      if (nextStartDate.getTime() > dueDate.getTime()) {
        toast.error("Ngày bắt đầu phải trước hoặc bằng ngày hết hạn.");
        resetRangeResize();
        return;
      }

      if (getDayKey(nextStartDate) === getDayKey(startDate)) {
        resetRangeResize();
        return;
      }

      updateSuccessToastRef.current = "Đã cập nhật khoảng thời gian";
      executeUpdateCard({
        id: range.item.cardId,
        boardId,
        startDate: nextStartDate,
        dueDateTimezoneOffset: getDateTimezoneOffset(nextStartDate),
      });
      return;
    }

    const nextDueDate = getDateWithPreservedTime(dueDate, targetDay);

    if (nextDueDate.getTime() < startDate.getTime()) {
      toast.error("Ngày hết hạn phải sau hoặc bằng ngày bắt đầu.");
      resetRangeResize();
      return;
    }

    if (getDayKey(nextDueDate) === getDayKey(dueDate)) {
      resetRangeResize();
      return;
    }

    const reminderError = getReminderError(nextDueDate, range.item.reminder);

    if (reminderError) {
      toast.error(reminderError);
      invalidateBoardCalendar();
      resetRangeResize();
      return;
    }

    updateSuccessToastRef.current = "Đã cập nhật khoảng thời gian";
    executeUpdateCard({
      id: range.item.cardId,
      boardId,
      dueDate: nextDueDate,
      dueDateTimezoneOffset: getDateTimezoneOffset(nextDueDate),
      isCompleted: range.item.isCompleted,
      ...(range.item.reminder !== null ? { reminder: range.item.reminder } : {}),
    });
  };

  const handleRangeResizeEnd = (event: PointerEvent<HTMLButtonElement>) => {
    if (!resizingRange || resizingRange.pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    const targetDayKey = getResizeTargetDayKey(event) ?? resizingRange.targetDayKey;
    const targetDay = daysByKey[targetDayKey];

    if (!targetDay) {
      resetRangeResize();
      return;
    }

    commitRangeResize(resizingRange.range, resizingRange.edge, targetDay);
  };

  const renderQuickActionsMenu = (occurrence: CalendarOccurrence) => {
    const isCardItem = isCalendarCardItem(occurrence.item);

    if (!isCardItem) {
      const checklistItem = occurrence.item as Extract<
        BoardCalendarItem,
        { type: "checklist-item" }
      >;

      return (
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
              }}
              onPointerDown={(event) => event.stopPropagation()}
              onDragStart={(event) => event.preventDefault()}
              aria-label={`Mở thao tác nhanh cho checklist item ${occurrence.item.title}`}
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-neutral-500 opacity-100 transition hover:bg-white/70 hover:text-neutral-900 focus-visible:bg-white/70 focus-visible:text-neutral-900 sm:opacity-0 sm:group-hover/event:opacity-100 sm:group-focus-within/event:opacity-100"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            sideOffset={6}
            className="w-56 gap-1 p-1.5"
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={(event) => handleQuickActionClick(event, () => cardModal.onOpen(checklistItem.cardId, {
                checklistItemId: checklistItem.checklistItemId,
              }))}
              className="flex h-8 w-full items-center gap-x-2 rounded-md px-2 text-left text-xs font-medium text-neutral-700 transition hover:bg-neutral-100"
            >
              <ExternalLink className="h-3.5 w-3.5 text-neutral-500" />
              Mở thẻ
            </button>
          </PopoverContent>
        </Popover>
      );
    }

    return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
          }}
          onPointerDown={(event) => event.stopPropagation()}
          onDragStart={(event) => event.preventDefault()}
          disabled={isUpdatingCardDate}
          aria-label={`Mở thao tác nhanh cho thẻ ${occurrence.item.title}`}
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-neutral-500 opacity-100 transition hover:bg-white/70 hover:text-neutral-900 focus-visible:bg-white/70 focus-visible:text-neutral-900 disabled:cursor-wait disabled:opacity-40 sm:opacity-0 sm:group-hover/event:opacity-100 sm:group-focus-within/event:opacity-100"
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={6}
        className="w-56 gap-1 p-1.5"
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          disabled={isUpdatingCardDate}
          onClick={(event) => handleQuickActionClick(event, () => cardModal.onOpen(occurrence.item.cardId))}
          className="flex h-8 w-full items-center gap-x-2 rounded-md px-2 text-left text-xs font-medium text-neutral-700 transition hover:bg-neutral-100 disabled:cursor-wait disabled:opacity-50"
        >
          <ExternalLink className="h-3.5 w-3.5 text-neutral-500" />
          Mở thẻ
        </button>
        <button
          type="button"
          disabled={isUpdatingCardDate}
          onClick={(event) => handleQuickActionClick(event, () => toggleCalendarCardComplete(occurrence))}
          className="flex h-8 w-full items-center gap-x-2 rounded-md px-2 text-left text-xs font-medium text-neutral-700 transition hover:bg-neutral-100 disabled:cursor-wait disabled:opacity-50"
        >
          {occurrence.item.isCompleted ? (
            <Circle className="h-3.5 w-3.5 text-neutral-500" />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
          )}
          {occurrence.item.isCompleted ? "Bỏ hoàn thành" : "Đánh dấu hoàn thành"}
        </button>
        {isCardItem && canClearStartDate(occurrence) && (
          <button
            type="button"
            disabled={isUpdatingCardDate}
            onClick={(event) => handleQuickActionClick(event, () => clearCalendarStartDate(occurrence))}
            className="flex h-8 w-full items-center gap-x-2 rounded-md px-2 text-left text-xs font-medium text-neutral-700 transition hover:bg-neutral-100 disabled:cursor-wait disabled:opacity-50"
          >
            <CalendarX2 className="h-3.5 w-3.5 text-sky-600" />
            Xóa ngày bắt đầu
          </button>
        )}
        {isCardItem && canClearDueDate(occurrence) && (
          <button
            type="button"
            disabled={isUpdatingCardDate}
            onClick={(event) => handleQuickActionClick(event, () => clearCalendarDueDate(occurrence))}
            className="flex h-8 w-full items-center gap-x-2 rounded-md px-2 text-left text-xs font-medium text-neutral-700 transition hover:bg-neutral-100 disabled:cursor-wait disabled:opacity-50"
          >
            <CalendarX2 className="h-3.5 w-3.5 text-violet-600" />
            Xóa ngày hết hạn
          </button>
        )}
      </PopoverContent>
    </Popover>
    );
  };

  const renderExpandedOccurrence = (occurrence: CalendarOccurrence) => (
    <Hint key={`expanded:${occurrence.id}`} description={getCalendarItemTitle(occurrence.item)} side="top" sideOffset={4} className="max-w-[280px]">
      <div
        className="group/event flex min-w-0 items-start gap-x-2 rounded-lg border border-neutral-200 bg-neutral-50 p-2 text-left transition hover:border-violet-200 hover:bg-violet-50"
      >
        <button
          type="button"
          onClick={(event) => openCalendarCard(
            occurrence.item.cardId,
            event,
            occurrence.item.type === "checklist-item"
              ? { checklistItemId: occurrence.item.checklistItemId }
              : undefined,
          )}
          aria-label={occurrence.item.type === "checklist-item"
            ? `Mở mục checklist ${occurrence.item.title} trong thẻ ${occurrence.item.cardTitle}`
            : `Mở thẻ ${occurrence.item.title}`}
          title={occurrence.item.type === "checklist-item"
            ? `Mở mục checklist ${occurrence.item.title} trong thẻ ${occurrence.item.cardTitle}`
            : `Mở thẻ ${occurrence.item.title}`}
          className="flex min-w-0 flex-1 items-start gap-x-2 text-left"
        >
          <div className={cn(
            "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
            getOccurrenceTone(occurrence),
          )}>
            {occurrence.item.isCompleted ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <Clock className="h-4 w-4" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-neutral-900">
              {occurrence.item.title}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500">
              {getOccurrenceLabel(occurrence) && (
                <span>{getOccurrenceLabel(occurrence)}</span>
              )}
              {getOccurrenceTimeLabel(occurrence) && (
                <span>{getOccurrenceTimeLabel(occurrence)}</span>
              )}
              <span className="truncate">{occurrence.item.listTitle}</span>
              {getCalendarItemAssigneeCount(occurrence.item) > 0 && (
                <span className="inline-flex items-center gap-x-1">
                  <UsersRound className="h-3.5 w-3.5" />
                  {getCalendarItemAssigneeCount(occurrence.item)}
                </span>
              )}
              {getCalendarItemCommentCount(occurrence.item) > 0 && (
                <span className="inline-flex items-center gap-x-1">
                  <MessageSquare className="h-3.5 w-3.5" />
                  {getCalendarItemCommentCount(occurrence.item)}
                </span>
              )}
            </div>
          </div>
        </button>
        {renderQuickActionsMenu(occurrence)}
      </div>
    </Hint>
  );

  const renderOccurrence = (
    occurrence: CalendarOccurrence,
    className?: string,
  ) => {
    const timeLabel = getOccurrenceTimeLabel(occurrence);
    const occurrenceLabel = variant === "split" ? null : getOccurrenceLabel(occurrence);
    const cardItem = isCalendarCardItem(occurrence.item) ? occurrence.item : null;
    const isChecklistItem = isCalendarChecklistItem(occurrence.item);
    const canDragOccurrence =
      occurrence.kind !== "range" &&
      (!!cardItem || isChecklistItem) &&
      !isUpdatingCardDate &&
      !isUpdatingChecklistItemDueDate;

    return (
      <Hint
        key={occurrence.id}
        description={getCalendarItemTitle(occurrence.item)}
        side="top"
        sideOffset={4}
        className="max-w-[280px]"
      >
        <div
          draggable={canDragOccurrence}
          onDragStart={(event) => handleOccurrenceDragStart(event, occurrence)}
          onDragEnd={handleOccurrenceDragEnd}
          className={cn(
            "group/event flex h-7 w-full min-w-0 items-center gap-x-1 overflow-hidden rounded-md border px-1.5 text-left text-[11px] font-medium leading-none transition",
            occurrence.kind === "range" || (!cardItem && !isChecklistItem)
              ? "cursor-default"
              : "cursor-grab active:cursor-grabbing",
            getOccurrenceTone(occurrence),
            draggingOccurrenceId === occurrence.id && "opacity-60 ring-2 ring-violet-300",
            (isUpdatingCardDate || isUpdatingChecklistItemDueDate) && "cursor-wait opacity-70",
            className,
          )}
        >
          <button
            type="button"
            onClick={(event) => openCalendarCard(
              occurrence.item.cardId,
              event,
              occurrence.item.type === "checklist-item"
                ? { checklistItemId: occurrence.item.checklistItemId }
                : undefined,
            )}
            aria-label={occurrence.item.type === "checklist-item"
              ? `Mở mục checklist ${occurrence.item.title} trong thẻ ${occurrence.item.cardTitle}`
              : `Mở thẻ ${occurrence.item.title}`}
            title={occurrence.item.type === "checklist-item"
              ? `Mở mục checklist ${occurrence.item.title} trong thẻ ${occurrence.item.cardTitle}`
              : `Mở thẻ ${occurrence.item.title}`}
            className="flex h-full min-w-0 flex-1 items-center gap-x-1 overflow-hidden text-left"
          >
            {cardItem?.labels[0] && (
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: cardItem.labels[0].color }}
              />
            )}
            {!cardItem && !occurrence.item.isCompleted && (
              <ListChecks className="h-3 w-3 shrink-0 opacity-80" />
            )}
            {occurrence.item.isCompleted && (
              <CheckCircle2 className="h-3 w-3 shrink-0 opacity-80" />
            )}
            {timeLabel && (
              <span className="shrink-0 rounded bg-white/70 px-1 py-0.5 text-[10px] font-semibold tabular-nums opacity-90">
                {timeLabel}
              </span>
            )}
            {occurrenceLabel && (
              <span className="hidden shrink-0 text-[10px] font-semibold uppercase tracking-wide opacity-70 md:inline">
                {occurrenceLabel}
              </span>
            )}
            <span className="truncate">{occurrence.item.title}</span>
          </button>
          {variant !== "split" && renderQuickActionsMenu(occurrence)}
        </div>
      </Hint>
    );
  };

  const renderRangeSegment = (
    segment: CalendarRangeSegment,
    maxLanes: number,
    mode: ViewMode,
  ) => {
    const isHidden = segment.lane >= maxLanes;

    if (isHidden) {
      return null;
    }

    const occurrence: CalendarOccurrence = {
      id: segment.id,
      kind: "range",
      date: segment.range.startDate,
      item: segment.range.item,
    };
    const leftPercent = (segment.startIndex / 7) * 100;
    const widthPercent = ((segment.endIndex - segment.startIndex + 1) / 7) * 100;
    const style: CSSProperties = {
      left: `${leftPercent}%`,
      width: `${widthPercent}%`,
      top: 36 + segment.lane * (RANGE_LANE_HEIGHT + RANGE_LANE_GAP),
    };
    const isResizingThisRange = resizingRange?.range.id === segment.range.id;
    const startDate = parseCalendarDate(segment.range.item.startDate);
    const dueDate = parseCalendarDate(segment.range.item.dueDate);
    const startTimeLabel = (segment.isRangeStart && startDate) ? formatCalendarTime(startDate) : null;
    const endTimeLabel = (segment.isRangeEnd && dueDate) ? formatCalendarTime(dueDate) : null;

    return (
      <Hint
        key={segment.id}
        description={getCalendarItemTitle(segment.range.item)}
        side="top"
        sideOffset={4}
        className="max-w-[280px]"
      >
        <div
          style={style}
          className={cn(
            "group/event absolute z-10 h-7 min-w-0 px-0.5",
            mode === "week" && "hidden md:block",
            (resizingRange || draggingOccurrenceId || draggingUnscheduledCardId || draggingBoardCardId || draggingDayViewBlockId) && "pointer-events-none",
          )}
        >
          <div
            className={cn(
              "relative flex h-full min-w-0 items-center gap-x-1 overflow-hidden border text-left text-[11px] font-medium leading-none shadow-sm transition",
              getOccurrenceTone(occurrence),
              segment.isRangeStart ? "rounded-l-md pl-3" : "rounded-l-none border-l-0 pl-1.5",
              segment.isRangeEnd ? "rounded-r-md pr-3" : "rounded-r-none border-r-0 pr-1.5",
              isResizingThisRange && "opacity-80 ring-2 ring-violet-300",
              isUpdatingCardDate && "cursor-wait opacity-70",
            )}
          >
            {segment.isRangeStart && (
              <Hint description="Đổi ngày bắt đầu" side="top">
                <button
                  type="button"
                  aria-label="Đổi ngày bắt đầu"
                  disabled={isUpdatingCardDate}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                  }}
                  onPointerDown={(event) => handleRangeResizeStart(event, segment.range, "start")}
                  onPointerMove={handleRangeResizeMove}
                  onPointerUp={handleRangeResizeEnd}
                  onPointerCancel={resetRangeResize}
                  className="absolute left-0 top-0 bottom-0 w-2.5 flex items-center justify-center cursor-ew-resize rounded-l-md hover:bg-neutral-500/10 active:bg-neutral-500/20 transition-colors focus-visible:outline-none disabled:cursor-wait md:flex hidden pointer-events-auto"
                >
                  <div className="flex gap-[1px]">
                    <div className="h-3 w-[1px] bg-neutral-600/60 rounded-full" />
                    <div className="h-3 w-[1px] bg-neutral-600/60 rounded-full" />
                  </div>
                </button>
              </Hint>
            )}
            <button
              type="button"
              onClick={(event) => openCalendarCard(segment.range.item.cardId, event)}
              aria-label={`Mở thẻ ${segment.range.item.title}`}
              className="flex h-full min-w-0 flex-1 items-center gap-x-1 overflow-hidden text-left"
            >
              {segment.range.item.labels[0] && (
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: segment.range.item.labels[0].color }}
                />
              )}
              {!segment.isRangeStart && (
                <span className="shrink-0 text-[10px] font-semibold opacity-70">↤</span>
              )}
              {startTimeLabel && (
                <span className="shrink-0 rounded bg-white/70 px-1 py-0.5 text-[10px] font-semibold tabular-nums opacity-90">
                  {startTimeLabel}
                </span>
              )}
              {segment.range.item.isCompleted && (
                <CheckCircle2 className="h-3 w-3 shrink-0 opacity-80" />
              )}
              <span className="truncate">{segment.range.item.title}</span>
              {endTimeLabel && (
                <span className="ml-auto shrink-0 rounded bg-white/70 px-1 py-0.5 text-[10px] font-semibold tabular-nums opacity-90">
                  {endTimeLabel}
                </span>
              )}
              {!segment.isRangeEnd && (
                <span className="shrink-0 text-[10px] font-semibold opacity-70">↦</span>
              )}
            </button>
            {variant !== "split" && renderQuickActionsMenu(occurrence)}
            {segment.isRangeEnd && (
              <Hint description="Đổi ngày hết hạn" side="top">
                <button
                  type="button"
                  aria-label="Đổi ngày hết hạn"
                  disabled={isUpdatingCardDate}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                  }}
                  onPointerDown={(event) => handleRangeResizeStart(event, segment.range, "end")}
                  onPointerMove={handleRangeResizeMove}
                  onPointerUp={handleRangeResizeEnd}
                  onPointerCancel={resetRangeResize}
                  className="absolute right-0 top-0 bottom-0 w-2.5 flex items-center justify-center cursor-ew-resize rounded-r-md hover:bg-neutral-500/10 active:bg-neutral-500/20 transition-colors focus-visible:outline-none disabled:cursor-wait md:flex hidden pointer-events-auto"
                >
                  <div className="flex gap-[1px]">
                    <div className="h-3 w-[1px] bg-neutral-600/60 rounded-full" />
                    <div className="h-3 w-[1px] bg-neutral-600/60 rounded-full" />
                  </div>
                </button>
              </Hint>
            )}
          </div>
        </div>
      </Hint>
    );
  };

  const renderRangeOverflows = (
    weekDays: Date[],
    segments: CalendarRangeSegment[],
    maxLanes: number,
    mode: ViewMode,
  ) => {
    return weekDays.map((day, dayIndex) => {
      const dayKey = getDayKey(day);
      const rangeOverflowCount = segments.filter(
        (segment) =>
          segment.lane >= maxLanes &&
          segment.startIndex <= dayIndex &&
          segment.endIndex >= dayIndex
      ).length;

      if (rangeOverflowCount === 0) {
        return null;
      }

      const leftPercent = (dayIndex / 7) * 100;
      const widthPercent = (1 / 7) * 100;
      const style: CSSProperties = {
        left: `${leftPercent}%`,
        width: `${widthPercent}%`,
        top: 36 + maxLanes * (RANGE_LANE_HEIGHT + RANGE_LANE_GAP),
      };

      return (
        <button
          key={`range-overflow-${dayKey}`}
          type="button"
          style={style}
          onClick={() => setExpandedDayKey(dayKey)}
          className={cn(
            "absolute z-10 h-7 px-0.5 focus:outline-none",
            mode === "week" && "hidden md:block"
          )}
        >
          <div className="flex h-full w-full items-center justify-center rounded-md bg-neutral-100 px-1.5 text-[11px] font-semibold text-neutral-500 hover:bg-neutral-200 transition">
            +{rangeOverflowCount} dải
          </div>
        </button>
      );
    });
  };

  const renderCalendarDay = (day: Date, index: number) => {
    const dayKey = getDayKey(day);
    const dayOccurrences = occurrencesByDay[dayKey] ?? [];
    const dayRangeOccurrences = rangeOccurrencesByDay[dayKey] ?? [];
    const desktopOverflow = Math.max(dayOccurrences.length - maxVisibleDesktop, 0);
    const mobileOverflow = Math.max(dayOccurrences.length - maxVisibleMobile, 0);

    const dayIndex = index % 7;
    const weekIndex = Math.floor(index / 7);
    const weekSegments = rangeSegmentsByWeek[weekIndex] ?? [];
    const maxLanes = viewMode === "month" ? MONTH_RANGE_LANES : WEEK_RANGE_LANES;

    const activeSegments = weekSegments.filter(
      (s) => s.startIndex <= dayIndex && s.endIndex >= dayIndex
    );
    const hasRangeOverflow = activeSegments.some((s) => s.lane >= maxLanes);
    const maxVisibleLane = activeSegments
      .filter((s) => s.lane < maxLanes)
      .reduce((max, s) => Math.max(max, s.lane), -1);

    let pt = 0;
    if (hasRangeOverflow) {
      pt = 36 + maxLanes * (RANGE_LANE_HEIGHT + RANGE_LANE_GAP);
    } else if (maxVisibleLane >= 0) {
      pt = 36 + (maxVisibleLane + 1) * (RANGE_LANE_HEIGHT + RANGE_LANE_GAP);
    }

    const markerListStyle: CalendarMarkerListStyle | undefined = pt > 0
      ? viewMode === "month"
        ? { paddingTop: `${pt}px` }
        : { "--pt-desktop": `${pt}px` }
      : undefined;

    return (
      <div
        key={dayKey}
        data-calendar-day-key={dayKey}
        onDragOver={(event) => handleDayDragOver(event, dayKey)}
        onDragEnter={(event) => handleDayDragOver(event, dayKey)}
        onDragLeave={() => setDragOverDayKey((value) => value === dayKey ? null : value)}
        onDrop={(event) => handleDayDrop(event, day)}
        className={cn(
          "group/day overflow-hidden border-neutral-200 bg-white p-1.5 transition-colors md:p-2",
          viewMode === "month" && "min-h-[104px] border-r border-b sm:min-h-[132px]",
          viewMode === "month" && index % 7 === 6 && "border-r-0",
          viewMode === "week" && "min-h-[132px] rounded-lg border md:min-h-[360px]",
          viewMode === "week" && index > 0 && "mt-2 md:mt-0",
          viewMode === "month" && !isSameMonth(day, currentMonth) && "bg-neutral-50/80 text-neutral-400",
          (draggingOccurrenceId || draggingUnscheduledCardId || draggingBoardCardId || draggingDayViewBlockId) && "ring-inset ring-violet-100",
          resizingRange && "cursor-ew-resize ring-inset ring-violet-100",
          dragOverDayKey === dayKey && "bg-violet-50 ring-2 ring-inset ring-violet-300",
        )}
      >
        <div className="mb-1 flex h-7 items-center justify-between gap-x-2">
          <div className="flex min-w-0 items-center gap-x-1.5">
            {viewMode === "week" && (
              <span className="truncate text-[11px] font-semibold uppercase text-neutral-500">
                {WEEK_DAYS[index]}
              </span>
            )}
            <span
              className={cn(
                "flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full px-1.5 text-xs font-semibold text-neutral-600",
                viewMode === "month" && !isSameMonth(day, currentMonth) && "text-neutral-400",
                isToday(day) && "bg-violet-600 text-white",
              )}
            >
              {viewMode === "week" ? format(day, "dd/MM") : format(day, "d")}
            </span>
          </div>
          <Hint description={lists.length === 0 ? "Tạo danh sách trước khi thêm thẻ từ lịch" : `Thêm thẻ vào ngày ${format(day, "dd/MM/yyyy")}`} side="top">
            <button
              type="button"
              onClick={(event) => openCreateDialog(day, event)}
              disabled={
                !!resizingRange ||
                lists.length === 0 ||
                isCreatingCard ||
                isUpdatingCardDate ||
                isUpdatingChecklistItemDueDate
              }
              aria-label={lists.length === 0 ? "Tạo danh sách trước khi thêm thẻ từ lịch" : `Thêm thẻ vào ngày ${format(day, "dd/MM/yyyy")}`}
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-neutral-400 opacity-100 transition hover:bg-violet-50 hover:text-violet-700 focus-visible:bg-violet-50 focus-visible:text-violet-700 disabled:cursor-not-allowed disabled:opacity-30 md:opacity-0 md:group-hover/day:opacity-100 md:focus-visible:opacity-100",
                isToday(day) && "text-violet-700",
              )}
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </Hint>
        </div>

        <div
          style={markerListStyle}
          className={cn(
            "space-y-1",
            viewMode === "week" && pt > 0 && "md:[padding-top:var(--pt-desktop)]",
          )}
        >
          {viewMode === "week" && dayRangeOccurrences.map((occurrence) =>
            renderOccurrence(occurrence, "md:hidden"),
          )}
          {dayOccurrences.slice(0, maxVisibleDesktop).map((occurrence, occurrenceIndex) =>
            renderOccurrence(
              occurrence,
              occurrenceIndex >= maxVisibleMobile ? "hidden sm:flex" : undefined,
            ),
          )}
          {mobileOverflow > 0 && (
            <button
              type="button"
              onClick={() => setExpandedDayKey(dayKey)}
              aria-label={`Xem thêm ${mobileOverflow} thẻ trong ngày ${format(day, "dd/MM/yyyy")}`}
              className="flex h-6 w-full items-center rounded-md px-1.5 text-left text-[11px] font-semibold text-neutral-500 transition hover:bg-neutral-100 sm:hidden"
            >
              +{mobileOverflow} thẻ
            </button>
          )}
          {desktopOverflow > 0 && (
            <button
              type="button"
              onClick={() => setExpandedDayKey(dayKey)}
              aria-label={`Xem thêm ${desktopOverflow} thẻ trong ngày ${format(day, "dd/MM/yyyy")}`}
              className="hidden h-6 w-full items-center rounded-md px-1.5 text-left text-[11px] font-semibold text-neutral-500 transition hover:bg-neutral-100 sm:flex"
            >
              +{desktopOverflow} thẻ
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderUnscheduledCard = (card: BoardCalendarUnscheduledCard) => (
    <button
      key={card.id}
      type="button"
      draggable={!isUpdatingCardDate && !isUpdatingChecklistItemDueDate}
      onDragStart={(event) => handleUnscheduledCardDragStart(event, card)}
      onDragEnd={handleUnscheduledCardDragEnd}
      onClick={() => {
        if (suppressClickRef.current) {
          return;
        }

        cardModal.onOpen(card.cardId);
      }}
      className={cn(
        "group/card w-full cursor-pointer rounded-lg border border-neutral-200 bg-white p-2 text-left transition hover:border-violet-200 hover:bg-violet-50 focus-visible:border-violet-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-100 active:cursor-grabbing disabled:cursor-wait disabled:opacity-60",
        draggingUnscheduledCardId === card.cardId && "opacity-60 ring-2 ring-violet-300",
      )}
      disabled={isUpdatingCardDate || isUpdatingChecklistItemDueDate}
      aria-label={`Mở thẻ ${card.title}`}
    >
      <div className="flex min-w-0 items-start justify-between gap-x-2">
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "line-clamp-2 text-sm font-semibold text-neutral-900",
              card.isCompleted && "text-neutral-500 line-through",
            )}
          >
            {card.title}
          </p>
          <p className="mt-1 truncate text-xs text-neutral-500">
            {card.listTitle}
          </p>
        </div>
        {card.isCompleted && (
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
        )}
      </div>

      {(card.labels.length > 0 || card.assignees.length > 0 || card.commentCount > 0) && (
        <div className="mt-2 flex min-w-0 items-center justify-between gap-x-2">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
            {card.labels.slice(0, 4).map((label) => (
              <span
                key={label.id}
                title={label.title || "Nhãn"}
                className="h-2 w-8 rounded-full"
                style={{ backgroundColor: label.color }}
              />
            ))}
            {card.labels.length > 4 && (
              <span className="text-[10px] font-semibold text-neutral-400">
                +{card.labels.length - 4}
              </span>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-x-2 text-xs text-neutral-500">
            {card.commentCount > 0 && (
              <span className="inline-flex items-center gap-x-1">
                <MessageSquare className="h-3.5 w-3.5" />
                {card.commentCount}
              </span>
            )}
            {card.assignees.length > 0 && (
              <div className="flex -space-x-1">
                {card.assignees.slice(0, 3).map((assignee) => (
                  <Avatar
                    key={assignee.id}
                    title={assignee.userName}
                    className="h-5 w-5 border border-white bg-neutral-200"
                  >
                    <AvatarImage src={assignee.userImage} alt={assignee.userName} />
                    <AvatarFallback className="text-[9px]">
                      {assignee.userName.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                ))}
                {card.assignees.length > 3 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full border border-white bg-neutral-100 px-1 text-[10px] font-semibold text-neutral-500">
                    +{card.assignees.length - 3}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </button>
  );

  const renderUnscheduledPanel = () => {
    if (isUnscheduledCollapsed) {
      return null;
    }

    const countLabel = filtersAreActive
      ? `${filteredUnscheduledCards.length}/${unscheduledCards.length}`
      : `${filteredUnscheduledCards.length}`;

    return (
      <aside
        className={cn(
          "flex min-h-0 w-full shrink-0 flex-col rounded-lg border border-white/20 bg-white/95 shadow-xl backdrop-blur",
          variant === "split" && isUnscheduledCollapsed && "lg:w-[180px]",
          variant === "split" && !isUnscheduledCollapsed && "lg:w-[260px] xl:w-[300px]",
          variant === "default" && "lg:w-[340px]",
        )}
      >
        <div className="flex h-14 shrink-0 items-center justify-between gap-x-3 border-b border-neutral-200 px-4">
          <div className="min-w-0">
            <div className="flex items-center gap-x-2">
              <h2 className="truncate text-sm font-semibold text-neutral-900">
                Chưa lên lịch
              </h2>
              <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-semibold text-neutral-600">
                {countLabel}
              </span>
            </div>
          </div>
          <Hint description={isUnscheduledCollapsed ? "Mở panel" : "Thu gọn panel"} side="top">
            <button
              type="button"
              onClick={() => setIsUnscheduledCollapsed((value) => !value)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-800"
              aria-label={isUnscheduledCollapsed ? "Mở panel chưa lên lịch" : "Thu gọn panel chưa lên lịch"}
            >
              {isUnscheduledCollapsed ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronUp className="h-4 w-4" />
              )}
            </button>
          </Hint>
        </div>

        {!isUnscheduledCollapsed && (
          <>
            <div className="grid shrink-0 gap-2 border-b border-neutral-100 p-3">
              <select
                value={filters.selectedListIds[0] ?? "all"}
                onChange={(event) =>
                  setSelectedLists(
                    boardId,
                    event.target.value === "all" ? [] : [event.target.value],
                  )
                }
                className="h-8 w-full rounded-md border border-neutral-200 bg-white px-2 text-xs font-medium text-neutral-700 outline-none transition focus:border-violet-400 focus:ring-1 focus:ring-violet-200"
                aria-label="Lọc thẻ chưa lên lịch theo danh sách"
              >
                <option value="all">Tất cả danh sách</option>
                {lists.map((list) => (
                  <option key={list.id} value={list.id}>
                    {list.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="min-h-[160px] flex-1 overflow-y-auto p-3">
              {query.isLoading && (
                <div className="space-y-2">
                  <Skeleton className="h-20 rounded-lg bg-neutral-100" />
                  <Skeleton className="h-20 rounded-lg bg-neutral-100" />
                  <Skeleton className="h-20 rounded-lg bg-neutral-100" />
                </div>
              )}

              {query.isError && (
                <div className="flex min-h-[120px] flex-col items-center justify-center rounded-lg border border-red-100 bg-red-50 px-3 text-center text-red-700">
                  <AlertCircle className="mb-2 h-5 w-5" />
                  <p className="text-xs font-semibold">
                    Không tải được thẻ chưa lên lịch.
                  </p>
                </div>
              )}

              {query.isSuccess && filteredUnscheduledCards.length > 0 && (
                <div className="space-y-2">
                  {filteredUnscheduledCards.map((card) => renderUnscheduledCard(card))}
                </div>
              )}

              {query.isSuccess && filteredUnscheduledCards.length === 0 && (
                <div className="flex min-h-[120px] flex-col items-center justify-center rounded-lg border border-dashed border-neutral-300 bg-neutral-50 px-3 text-center">
                  <CalendarX2 className="mb-2 h-5 w-5 text-neutral-400" />
                  <p className="text-xs font-semibold text-neutral-700">
                    {unscheduledCards.length === 0
                      ? "Không có thẻ chưa lên lịch."
                      : "Không có thẻ phù hợp với bộ lọc."}
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </aside>
    );
  };

  const renderDayViewBlock = (
    block: PositionedDayViewBlock,
    className: string,
    keySuffix: string,
  ) => {
    const isChecklistItem = block.item.type === "checklist-item";
    const checklistItemId = block.item.type === "checklist-item"
      ? block.item.checklistItemId
      : undefined;
    const isSinglePointCard =
      block.item.type === "card" &&
      Boolean(block.item.startDate) !== Boolean(block.item.dueDate);
    const tooltip = getDayViewBlockTooltip(block);
    const canDragDayViewBlock =
      (
        (
          block.item.type === "card" &&
          (!!block.item.startDate || !!block.item.dueDate)
        ) ||
        (
          block.item.type === "checklist-item" &&
          !!block.item.dueDate
        )
      ) &&
      !isUpdatingCardDate &&
      !isUpdatingChecklistItemDueDate;
    const canResizeDayViewBlock =
      block.item.type === "card" &&
      !!block.item.startDate &&
      !!block.item.dueDate &&
      !isUpdatingCardDate &&
      !isUpdatingChecklistItemDueDate;
    const isResizingThisBlock = resizingDayViewBlock?.block.id === block.id;
    const previewStartMinute =
      isResizingThisBlock && resizingDayViewBlock?.edge === "start"
        ? Math.min(resizingDayViewBlock.targetMinute, block.endMinute - 15)
        : block.startMinute;
    const previewEndMinute =
      isResizingThisBlock && resizingDayViewBlock?.edge === "end"
        ? Math.max(resizingDayViewBlock.targetMinute, block.startMinute + 15)
        : block.endMinute;
    const effectivePixelHeight =
      ((previewEndMinute - previewStartMinute) / 15) * DAY_VIEW_SLOT_HEIGHT;
    const isCompactBlock = effectivePixelHeight < 30;
    const canShowTitleRow =
      !isChecklistItem && !isSinglePointCard && !isCompactBlock;
    const canShowContext = isChecklistItem
      ? effectivePixelHeight >= 30
      : !isSinglePointCard && effectivePixelHeight >= 44;
    const canShowLabels =
      !isChecklistItem &&
      effectivePixelHeight >= 60 &&
      block.item.labels.length > 0;
    const blockStyle = isResizingThisBlock
      ? {
        ...getDayViewBlockStyle(block),
        top: `${(previewStartMinute / MINUTES_IN_DAY) * 100}%`,
        height: `${((previewEndMinute - previewStartMinute) / MINUTES_IN_DAY) * 100}%`,
      }
      : getDayViewBlockStyle(block);

    return (
      <Hint
        key={`${block.id}:${keySuffix}`}
        description={tooltip}
        side="top"
        sideOffset={4}
        className="max-w-[300px]"
      >
        <div
          role="button"
          tabIndex={0}
          style={{
            ...blockStyle,
            ...(isChecklistItem ? { zIndex: 20 } : {})
          }}
          title={tooltip}
          onClick={(event) => openCalendarCard(
            block.item.cardId,
            event,
            checklistItemId ? { checklistItemId } : undefined,
          )}
          draggable={canDragDayViewBlock}
          onDragStart={(event) => handleDayViewBlockDragStart(event, block)}
          onDragEnd={handleDayViewBlockDragEnd}
          onKeyDown={(event) => {
            if (event.key !== "Enter" && event.key !== " ") {
              return;
            }

            event.preventDefault();
            openCalendarCard(
              block.item.cardId,
              undefined,
              checklistItemId ? { checklistItemId } : undefined,
            );
          }}
          aria-label={isChecklistItem
            ? `Mở mục kiểm tra ${block.item.title}`
            : `Mở thẻ ${block.item.title}`}
          className={cn(
            "group/day-block pointer-events-auto absolute z-10 min-w-0 overflow-hidden rounded-md border text-left shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300",
            "flex flex-col justify-start",
            isCompactBlock || isChecklistItem ? "gap-y-0 px-1.5 py-0.5" : "gap-y-0.5 px-2 py-1",
            canDragDayViewBlock && "cursor-grab active:cursor-grabbing",
            draggingDayViewBlockId === block.id && "opacity-60 ring-2 ring-violet-300",
            isResizingThisBlock && "ring-2 ring-violet-300",
            getDayViewBlockTone(block),
            className,
          )}
        >
          {canResizeDayViewBlock && (
            <>
              <span
                role="separator"
                aria-orientation="horizontal"
                aria-label={`Resize bắt đầu thẻ ${block.item.title}`}
                tabIndex={0}
                draggable={false}
                onClick={(event) => event.stopPropagation()}
                onDragStart={(event) => event.preventDefault()}
                onPointerDown={(event) => handleDayViewBlockResizeStart(event, block, "start")}
                onPointerMove={handleDayViewBlockResizeMove}
                onPointerUp={handleDayViewBlockResizeEnd}
                onPointerCancel={resetDayViewBlockResize}
                className="absolute left-0 right-0 top-0 z-20 hidden h-1 cursor-ns-resize bg-violet-500/0 transition hover:bg-violet-500/20 focus-visible:bg-violet-500/25 focus-visible:outline-none md:block md:opacity-0 md:group-hover/day-block:opacity-100 md:group-focus-within/day-block:opacity-100"
              />
              <span
                role="separator"
                aria-orientation="horizontal"
                aria-label={`Resize kết thúc thẻ ${block.item.title}`}
                tabIndex={0}
                draggable={false}
                onClick={(event) => event.stopPropagation()}
                onDragStart={(event) => event.preventDefault()}
                onPointerDown={(event) => handleDayViewBlockResizeStart(event, block, "end")}
                onPointerMove={handleDayViewBlockResizeMove}
                onPointerUp={handleDayViewBlockResizeEnd}
                onPointerCancel={resetDayViewBlockResize}
                className="absolute bottom-0 left-0 right-0 z-20 hidden h-1 cursor-ns-resize bg-violet-500/0 transition hover:bg-violet-500/20 focus-visible:bg-violet-500/25 focus-visible:outline-none md:block md:opacity-0 md:group-hover/day-block:opacity-100 md:group-focus-within/day-block:opacity-100"
              />
            </>
          )}
          <span className="flex min-w-0 w-full items-center gap-x-1 text-[10px] font-semibold leading-none">
            {isChecklistItem && !block.item.isCompleted && (
              <ListChecks className="h-3 w-3 shrink-0 opacity-80" />
            )}
            {block.item.isCompleted && (
              <CheckCircle2 className="h-3 w-3 shrink-0 opacity-80" />
            )}
            <span className="shrink-0 rounded bg-white/70 px-1 py-0.5 tabular-nums">
              {getDayViewBlockTimeLabel(block)}
            </span>
            {isChecklistItem ? (
              <span className="min-w-0 truncate text-[10px] font-semibold leading-none ml-0.5">
                {block.item.title}
              </span>
            ) : isSinglePointCard || isCompactBlock ? (
              <span className="min-w-0 truncate text-[10px] font-semibold leading-none ml-0.5">
                {block.item.title}
              </span>
            ) : (
              isOverdue(block.item) && !block.item.isCompleted && (
                <span className="hidden shrink-0 text-[10px] uppercase opacity-80 sm:inline">
                  Quá hạn
                </span>
              )
            )}
          </span>
          {canShowTitleRow && (
            <span className="mt-1 min-w-0 truncate text-xs font-semibold leading-tight">
              {block.item.title}
            </span>
          )}
          {canShowContext && (
            <span className={cn(
              "min-w-0 truncate leading-none opacity-75",
              isChecklistItem ? "text-[8.5px] text-neutral-500 mt-[1px]" : "text-[11px] mt-0.5"
            )}>
              {isChecklistItem ? `Checklist: ${getDayViewBlockContext(block)}` : getDayViewBlockContext(block)}
            </span>
          )}
          {canShowLabels && (
            <span className="mt-1 flex min-w-0 gap-1 overflow-hidden">
              {block.item.labels.slice(0, 5).map((label) => (
                <span
                  key={label.id}
                  className="h-1.5 w-5 shrink-0 rounded-full"
                  style={{ backgroundColor: label.color }}
                  title={label.title}
                />
              ))}
            </span>
          )}
        </div>
      </Hint>
    );
  };

  const renderDayOverflowItem = (block: PositionedDayViewBlock) => {
    const isChecklistItem = block.item.type === "checklist-item";
    const checklistItemId = block.item.type === "checklist-item"
      ? block.item.checklistItemId
      : undefined;

    return (
      <button
        key={block.id}
        type="button"
        onClick={(event) => {
          setOpenDayOverflowGroupId(null);
          openCalendarCard(
            block.item.cardId,
            event,
            checklistItemId ? { checklistItemId } : undefined,
          );
        }}
        className="flex w-full min-w-0 items-start gap-x-2 rounded-md px-2 py-1.5 text-left transition hover:bg-neutral-100 focus-visible:bg-neutral-100 focus-visible:outline-none"
      >
        <span className={cn(
          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
          isChecklistItem ? "bg-amber-100 text-amber-700" : "bg-violet-100 text-violet-700",
          block.item.isCompleted && "bg-emerald-100 text-emerald-700",
        )}>
          {block.item.isCompleted ? (
            <CheckCircle2 className="h-3.5 w-3.5" />
          ) : isChecklistItem ? (
            <ListChecks className="h-3.5 w-3.5" />
          ) : (
            <Clock className="h-3.5 w-3.5" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-semibold text-neutral-800">
            {block.item.title}
          </span>
          <span className="mt-0.5 block truncate text-[11px] text-neutral-500">
            {getDayViewBlockTimeLabel(block)} · {getDayViewBlockContext(block)}
          </span>
        </span>
      </button>
    );
  };

  const renderDayOverflowGroup = (
    group: DayViewOverflowGroup,
    className: string,
    keySuffix: string,
  ) => {
    const instanceId = `${group.id}:${keySuffix}`;

    return (
      <Popover
        key={instanceId}
        open={openDayOverflowGroupId === instanceId}
        onOpenChange={(open) =>
          setOpenDayOverflowGroupId(open ? instanceId : null)
        }
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            style={{
              top: `${group.top}%`,
            }}
            className={cn(
              "pointer-events-auto absolute right-2 z-20 rounded-full border border-neutral-200 bg-white/95 px-2 py-1 text-[11px] font-semibold text-neutral-700 shadow-sm transition hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300",
              className,
            )}
            aria-label={`Xem thêm ${group.hiddenBlocks.length} mục bị chồng lịch`}
          >
            +{group.hiddenBlocks.length} mục
          </button>
        </PopoverTrigger>
        <PopoverContent
          side="left"
          align="start"
          sideOffset={8}
          className="w-72 rounded-lg border-neutral-200 p-2 shadow-xl"
        >
          <div className="border-b border-neutral-100 px-2 pb-2">
            <p className="text-xs font-semibold text-neutral-800">
              Mục bị chồng lịch
            </p>
            <p className="mt-0.5 text-[11px] text-neutral-500">
              {group.hiddenBlocks.length} mục chưa hiển thị trực tiếp
            </p>
          </div>
          <div className="mt-2 max-h-64 overflow-y-auto">
            {group.hiddenBlocks.map((block) => renderDayOverflowItem(block))}
          </div>
        </PopoverContent>
      </Popover>
    );
  };

  const renderCalendarDayTimeGrid = (isSkeleton = false) => {
    const anchorDayKey = getGmt7DayKey(anchorDate);
    const currentDayKey = getGmt7DayKey(currentTime);
    const currentParts = getGmt7Parts(currentTime);
    const isCurrentGmt7Day = anchorDayKey === currentDayKey;
    const currentTimeTop =
      ((currentParts.hours * 60 + currentParts.minutes) / (24 * 60)) * 100;

    return (
      <div className="min-w-0 overflow-hidden rounded-lg border border-neutral-200 bg-white">
        <div className="grid grid-cols-[56px_minmax(0,1fr)] border-b border-neutral-200 bg-neutral-50 sm:grid-cols-[68px_minmax(0,1fr)]">
          <div className="border-r border-neutral-200 px-2 py-2 text-[11px] font-semibold uppercase text-neutral-500">
            GMT+7
          </div>
          <div className="px-3 py-2 text-xs font-semibold text-neutral-700">
            {formatDayTitle(anchorDate)}
          </div>
        </div>

        <div className="relative grid grid-cols-[56px_minmax(0,1fr)] sm:grid-cols-[68px_minmax(0,1fr)]">
          <div className="bg-neutral-50">
            {DAY_TIME_SLOTS.map((slot) => (
              <div
                key={`time:${slot.label}`}
                className={cn(
                  "flex h-5 items-start justify-end border-r border-neutral-200 px-2 text-[10px] font-medium tabular-nums",
                  slot.isHour ? "text-neutral-600" : "text-neutral-400",
                )}
                style={{ height: DAY_VIEW_SLOT_HEIGHT }}
              >
                <span className="-translate-y-1/2 block">
                  {slot.isHour ? slot.label : String(slot.minute).padStart(2, "0")}
                </span>
              </div>
            ))}
          </div>

          <div
            className="relative min-w-0"
            data-calendar-day-key={anchorDayKey}
            data-calendar-day-view-grid="true"
            onDragOver={isSkeleton ? undefined : handleDayViewDragOver}
            onDragEnter={isSkeleton ? undefined : handleDayViewDragOver}
            onDragLeave={isSkeleton ? undefined : handleDayViewDragLeave}
            onDrop={isSkeleton ? undefined : handleDayViewDrop}
          >
            {DAY_TIME_SLOTS.map((slot) => (
              <div
                key={`slot:${slot.label}`}
                className={cn(
                  "h-5 border-t",
                  slot.isHour ? "border-neutral-300 bg-white" : "border-neutral-100 bg-white",
                )}
                style={{ height: DAY_VIEW_SLOT_HEIGHT }}
                aria-label={`Khung giờ ${slot.label} GMT+7`}
              >
                {isSkeleton && slot.index % 16 === 4 && (
                  <Skeleton className="ml-3 mt-1 h-3 w-24 rounded bg-neutral-100" />
                )}
              </div>
            ))}

            {!isSkeleton && dragOverDaySlotIndex !== null && (
              <div
                className="pointer-events-none absolute left-0 right-0 z-20 mx-1 rounded-md border border-violet-300 bg-violet-100/55 shadow-[inset_0_0_0_1px_rgba(139,92,246,0.12)]"
                style={{
                  top: dragOverDaySlotIndex * DAY_VIEW_SLOT_HEIGHT,
                  height: DAY_VIEW_SLOT_HEIGHT,
                }}
                aria-hidden="true"
              />
            )}

            {!isSkeleton && resizingDayViewBlock && dragOverDayMinute !== null && (
              <div
                className="pointer-events-none absolute left-0 right-0 z-20 mx-1 border-t border-violet-400 bg-violet-100/35"
                style={{
                  top: (dragOverDayMinute / 15) * DAY_VIEW_SLOT_HEIGHT,
                  height: 2,
                }}
                aria-hidden="true"
              />
            )}

            {!isSkeleton && dayViewBlocks.length > 0 && (
              <div className="pointer-events-none absolute inset-0">
                {desktopDayViewLayout.visibleBlocks.map((block) =>
                  renderDayViewBlock(
                    block,
                    "hidden md:flex md:left-[var(--day-block-left)] md:w-[var(--day-block-width)]",
                    "desktop",
                  ),
                )}
                {desktopDayViewLayout.overflowGroups.map((group) =>
                  renderDayOverflowGroup(group, "hidden md:block", "desktop"),
                )}
                {mobileDayViewLayout.visibleBlocks.map((block) =>
                  renderDayViewBlock(block, "left-2 right-2 flex md:hidden", "mobile"),
                )}
                {mobileDayViewLayout.overflowGroups.map((group) =>
                  renderDayOverflowGroup(group, "block md:hidden", "mobile"),
                )}
              </div>
            )}

            {isCurrentGmt7Day && (
              <div
                className="pointer-events-none absolute left-0 right-0 z-30 flex items-center"
                style={{ top: `${currentTimeTop}%` }}
                aria-hidden="true"
              >
                <span className="h-2 w-2 -translate-x-1 rounded-full bg-red-500" />
                <span className="h-px flex-1 bg-red-500" />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderCalendarWeekRow = (
    weekDays: Date[],
    weekIndex: number,
    mode: ViewMode,
  ) => {
    const segments = rangeSegmentsByWeek[weekIndex] ?? [];
    const maxLanes = mode === "month" ? MONTH_RANGE_LANES : WEEK_RANGE_LANES;

    return (
      <div
        key={`week-row:${weekIndex}`}
        className={cn(
          "relative grid grid-cols-7 bg-white",
          mode === "month" && weekIndex === weekRows.length - 1 && "rounded-b-lg",
          mode === "week" && "grid-cols-1 gap-2 bg-transparent md:grid-cols-7",
        )}
      >
        {weekDays.map((day, dayIndex) =>
          renderCalendarDay(day, weekIndex * 7 + dayIndex),
        )}
        {segments.map((segment) => renderRangeSegment(segment, maxLanes, mode))}
        {renderRangeOverflows(weekDays, segments, maxLanes, mode)}
      </div>
    );
  };

  return (
    <>
    <div className="flex h-full min-h-0 flex-col gap-3 lg:flex-row">
    <section className="flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-white/20 bg-white/95 shadow-xl backdrop-blur">
      <div className="flex shrink-0 flex-col gap-3 border-b border-neutral-200 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-x-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-700">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold text-neutral-900">
                {titleLabel}
              </h1>
              <p className="truncate text-xs text-neutral-500">
                {rangeLabel}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 lg:items-end">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsUnscheduledCollapsed((value) => !value)}
              className={cn(
                "h-8 gap-x-1.5 px-3 text-xs font-semibold shadow-sm border",
                isUnscheduledCollapsed
                  ? "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
                  : "border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100 hover:text-violet-800"
              )}
            >
              <CalendarX2 className="h-3.5 w-3.5 shrink-0" />
              <span>Chưa lên lịch ({filteredUnscheduledCards.length})</span>
            </Button>

            <div className="flex h-8 shrink-0 items-center rounded-lg border border-neutral-200 bg-white p-0.5 shadow-sm">
              {(["month", "week", "day"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => changeViewMode(mode)}
                  className={cn(
                    "h-7 rounded-md px-3 text-xs font-semibold text-neutral-600 transition hover:bg-neutral-100",
                    viewMode === mode && "bg-violet-600 text-white shadow-sm hover:bg-violet-600",
                  )}
                >
                  {mode === "month" ? "Tháng" : mode === "week" ? "Tuần" : "Ngày"}
                </button>
              ))}
            </div>

            <div className="flex h-8 shrink-0 items-center rounded-lg border border-neutral-200 bg-white p-0.5 shadow-sm">
              <Hint description={previousLabel} side="top">
                <button
                  type="button"
                  onClick={goToPrevious}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-neutral-600 transition hover:bg-neutral-100"
                  aria-label={previousLabel}
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              </Hint>
              <Hint description="Về hôm nay" side="top">
                <button
                  type="button"
                  onClick={goToToday}
                  className="h-7 rounded-md px-2 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100"
                >
                  Hôm nay
                </button>
              </Hint>
              <Hint description={nextLabel} side="top">
                <button
                  type="button"
                  onClick={goToNext}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-neutral-600 transition hover:bg-neutral-100"
                  aria-label={nextLabel}
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </Hint>
            </div>
          </div>

          <div className="grid w-full grid-cols-3 gap-2 text-xs text-neutral-600 md:w-[300px]">
            <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2">
              <p className="font-semibold text-neutral-900">{items.length}</p>
              <p className="truncate">thẻ có lịch</p>
            </div>
            <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2">
              <p className="font-semibold text-neutral-900">
                {items.filter((item) => item.isCompleted).length}
              </p>
              <p className="truncate">hoàn thành</p>
            </div>
            <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2">
              <p className="font-semibold text-neutral-900">
                {items.filter(isOverdue).length}
              </p>
              <p className="truncate">quá hạn</p>
            </div>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3 md:p-4">
        {viewMode === "month" && (
          <div className="grid grid-cols-7 rounded-t-lg border border-b-0 border-neutral-200 bg-neutral-50">
            {WEEK_DAYS.map((day) => (
              <div
                key={day}
                className="border-r border-neutral-200 px-1.5 py-2 text-center text-[11px] font-semibold uppercase text-neutral-500 last:border-r-0"
              >
                {day}
              </div>
            ))}
          </div>
        )}

        {query.isLoading && viewMode === "day" && renderCalendarDayTimeGrid(true)}

        {query.isLoading && viewMode !== "day" && (
          <div
            className={cn(
              viewMode === "month" && "grid grid-cols-7 rounded-b-lg border border-neutral-200",
              viewMode === "week" && "grid grid-cols-1 gap-2 md:grid-cols-7",
            )}
          >
            {days.map((day, index) => (
              <div
                key={day.toISOString()}
                className={cn(
                  "border-neutral-200 p-1.5 md:p-2",
                  viewMode === "month" && "min-h-[104px] border-r border-b last:border-r-0 sm:min-h-[132px]",
                  viewMode === "week" && "min-h-[132px] rounded-lg border md:min-h-[360px]",
                  viewMode === "week" && index > 0 && "mt-2 md:mt-0",
                )}
              >
                <Skeleton className="mb-3 h-4 w-12 rounded bg-neutral-100" />
                <Skeleton className="mb-1.5 h-7 rounded-md bg-neutral-100" />
                <Skeleton className="h-7 rounded-md bg-neutral-100" />
              </div>
            ))}
          </div>
        )}

        {query.isError && (
          <div className="flex min-h-[320px] flex-col items-center justify-center rounded-b-lg border border-red-100 bg-red-50 px-4 text-center text-red-700">
            <AlertCircle className="mb-2 h-6 w-6" />
            <p className="text-sm font-semibold">Không tải được dữ liệu lịch.</p>
            <p className="mt-1 max-w-md text-xs text-red-600">
              Vui lòng thử tải lại trang hoặc kiểm tra quyền truy cập bảng.
            </p>
          </div>
        )}

        {query.isSuccess && (
          <>
            {viewMode === "month" ? (
              <div className="overflow-hidden rounded-b-lg border border-neutral-200 bg-white">
                {weekRows.map((weekDays, weekIndex) =>
                  renderCalendarWeekRow(weekDays, weekIndex, "month"),
                )}
              </div>
            ) : viewMode === "week" ? (
              renderCalendarWeekRow(weekRows[0] ?? days, 0, "week")
            ) : (
              renderCalendarDayTimeGrid()
            )}

            {items.length === 0 && viewMode !== "day" && (
              <div className="mt-3 flex min-h-[96px] flex-col items-center justify-center rounded-lg border border-dashed border-neutral-300 bg-neutral-50 px-4 text-center">
                <CalendarDays className="mb-2 h-6 w-6 text-neutral-400" />
                <p className="text-sm font-semibold text-neutral-700">
                  {filtersAreActive
                    ? "Không có mục nào phù hợp với bộ lọc."
                    : "Chưa có thẻ nào trong khoảng thời gian này."}
                </p>
                {!filtersAreActive && (
                  <p className="mt-1 max-w-md text-xs text-neutral-500">
                    Các thẻ có ngày bắt đầu hoặc ngày hết hạn sẽ xuất hiện trong lịch.
                  </p>
                )}
              </div>
            )}

            {items.length === 0 && viewMode === "day" && (
              <div className="mt-3 rounded-lg border border-dashed border-neutral-300 bg-neutral-50 px-4 py-3 text-center">
                <p className="text-sm font-semibold text-neutral-700">
                  {filtersAreActive
                    ? "Không có mục nào phù hợp với bộ lọc."
                    : "Chưa có thẻ nào trong ngày này."}
                </p>
              </div>
            )}

            {expandedDayKey && expandedDayItems.length > 0 && (() => {
              const cards = expandedDayItems.filter((o) => o.item.type === "card");
              const checklistItems = expandedDayItems.filter((o) => o.item.type === "checklist-item");

              return (
                <div className="mt-3 rounded-lg border border-neutral-200 bg-white p-3 shadow-sm">
                  <div className="mb-2 flex items-center justify-between gap-x-2 border-b border-neutral-100 pb-2">
                    <p className="text-sm font-semibold text-neutral-800">
                      {format(new Date(`${expandedDayKey}T00:00:00`), "EEEE, dd/MM/yyyy", { locale: vi })}
                    </p>
                    <button
                      type="button"
                      onClick={() => setExpandedDayKey(null)}
                      className="rounded-md px-2 py-1 text-xs font-semibold text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-800"
                    >
                      Đóng
                    </button>
                  </div>

                  {cards.length > 0 && (
                    <div className="mt-3 space-y-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400">Thẻ công việc</h4>
                      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                        {cards.map((occurrence) => renderExpandedOccurrence(occurrence))}
                      </div>
                    </div>
                  )}

                  {checklistItems.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400">Checklist</h4>
                      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                        {checklistItems.map((occurrence) => renderExpandedOccurrence(occurrence))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </>
        )}
      </div>
    </section>
    {renderUnscheduledPanel()}
    </div>
    <Dialog open={!!createDialogDay} onOpenChange={closeCreateDialog}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Thêm thẻ vào ngày {selectedCreateDayLabel}</DialogTitle>
          <DialogDescription>
            Thẻ mới sẽ có hạn lúc {createTime || DEFAULT_CREATE_TIME} theo giờ địa phương.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            submitCreateCard();
          }}
        >
          <div className="space-y-1.5">
            <label htmlFor="calendar-card-title" className="text-xs font-semibold text-neutral-600">
              Tiêu đề
            </label>
            <input
              id="calendar-card-title"
              value={createTitle}
              onChange={(event) => setCreateTitle(event.target.value)}
              disabled={isCreatingCard}
              autoFocus
              placeholder="Nhập tiêu đề thẻ..."
              className="h-9 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-800 shadow-sm outline-none transition placeholder:text-neutral-400 focus:border-violet-400 focus:ring-1 focus:ring-violet-200 disabled:cursor-not-allowed disabled:bg-neutral-50"
            />
            {createFieldErrors?.title?.[0] && (
              <p className="text-xs text-red-600">{createFieldErrors.title[0]}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="calendar-card-list" className="text-xs font-semibold text-neutral-600">
              Danh sách
            </label>
            <select
              id="calendar-card-list"
              value={createListId}
              onChange={(event) => setCreateListId(event.target.value)}
              disabled={isCreatingCard || lists.length === 0}
              className="h-9 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-800 shadow-sm outline-none transition focus:border-violet-400 focus:ring-1 focus:ring-violet-200 disabled:cursor-not-allowed disabled:bg-neutral-50"
            >
              {lists.length === 0 ? (
                <option value="">Tạo danh sách trước khi thêm thẻ từ lịch</option>
              ) : (
                lists.map((list) => (
                  <option key={list.id} value={list.id}>
                    {list.title}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="calendar-card-time" className="text-xs font-semibold text-neutral-600">
              Giờ hết hạn
            </label>
            <input
              id="calendar-card-time"
              type="time"
              value={createTime}
              onChange={(event) => setCreateTime(event.target.value)}
              disabled={isCreatingCard}
              className="h-9 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-800 shadow-sm outline-none transition focus:border-violet-400 focus:ring-1 focus:ring-violet-200 disabled:cursor-not-allowed disabled:bg-neutral-50"
            />
          </div>

          <DialogFooter className="mt-2">
            <Button
              type="button"
              variant="outline"
              disabled={isCreatingCard}
              onClick={() => closeCreateDialog(false)}
            >
              Hủy
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isCreatingCard || lists.length === 0}
            >
              Tạo thẻ
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    </>
  );
};
