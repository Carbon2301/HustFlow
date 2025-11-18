"use client";

import { useCallback, useMemo, useRef, useState, type CSSProperties, type DragEvent, type MouseEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
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
  subMonths,
  subWeeks,
} from "date-fns";
import { vi } from "date-fns/locale";
import {
  AlertCircle,
  CalendarDays,
  CalendarX2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock,
  ExternalLink,
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
import { useAction } from "@/hooks/use-action";
import { createCard } from "@/actions/create-card";
import { updateCard } from "@/actions/update-card";
import { Button } from "@/components/ui/button";
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
import type { BoardCalendarItem, BoardCalendarResponse } from "@/types";

interface BoardCalendarViewProps {
  boardId: string;
  lists: BoardCalendarList[];
}

type BoardCalendarList = {
  id: string;
  title: string;
  order: number;
};

type ViewMode = "month" | "week";
type CalendarOccurrenceKind = "single" | "start" | "due" | "range";

type CalendarOccurrence = {
  id: string;
  kind: CalendarOccurrenceKind;
  date: Date;
  item: BoardCalendarItem;
};

type CalendarRange = {
  id: string;
  item: BoardCalendarItem;
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

type CalendarDragPayload = {
  occurrenceId: string;
};

const WEEK_DAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
const MONTH_VISIBLE_DESKTOP = 3;
const MONTH_VISIBLE_MOBILE = 2;
const MONTH_RANGE_LANES = 2;
const WEEK_RANGE_LANES = 4;
const RANGE_LANE_HEIGHT = 28;
const RANGE_LANE_GAP = 4;
const WEEK_VISIBLE_DESKTOP = 8;
const WEEK_VISIBLE_MOBILE = 4;
const DEFAULT_CREATE_HOUR = 9;

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

const getDayKey = (date: Date) => format(date, "yyyy-MM-dd");

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

const getOccurrenceLabel = (occurrence: CalendarOccurrence) => {
  if (occurrence.kind === "start") {
    return "Bắt đầu";
  }

  if (occurrence.kind === "due") {
    return "Hết hạn";
  }

  if (occurrence.kind === "range") {
    const start = parseCalendarDate(occurrence.item.startDate);
    const due = parseCalendarDate(occurrence.item.dueDate);

    if (start && due) {
      return `${format(start, "dd/MM")} - ${format(due, "dd/MM")}`;
    }

    return "Trong ngày";
  }

  // Handles occurrence.kind === "single"
  const start = parseCalendarDate(occurrence.item.startDate);
  const due = parseCalendarDate(occurrence.item.dueDate);

  if (start && !due) {
    return "Bắt đầu";
  }

  if (!start && due) {
    return "Hết hạn";
  }

  if (start && due) {
    if (start.getTime() === due.getTime()) {
      return "Trong ngày";
    }
    return `${format(start, "HH:mm")} - ${format(due, "HH:mm")}`;
  }

  return "Lịch";
};

const getRangeLabel = (item: BoardCalendarItem) => {
  const startDate = parseCalendarDate(item.startDate);
  const dueDate = parseCalendarDate(item.dueDate);

  if (!startDate || !dueDate) {
    return item.title;
  }

  return `${item.title} - ${format(startDate, "dd/MM/yyyy", { locale: vi })} đến ${format(dueDate, "dd/MM/yyyy", { locale: vi })}`;
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

const getDefaultDueDateForDay = (day: Date) =>
  new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    DEFAULT_CREATE_HOUR,
    0,
    0,
    0,
  );

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
  if (!item.dueDate || item.isCompleted) {
    return false;
  }

  return new Date(item.dueDate).getTime() < Date.now();
};

const getOccurrenceTone = (occurrence: CalendarOccurrence) => {
  if (occurrence.item.isCompleted) {
    return "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100";
  }

  if (isOverdue(occurrence.item) && occurrence.kind !== "start") {
    return "border-red-200 bg-red-50 text-red-800 hover:bg-red-100";
  }

  if (occurrence.kind === "start") {
    return "border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100";
  }

  return "border-violet-200 bg-violet-50 text-violet-800 hover:bg-violet-100";
};

const getOccurrences = (items: BoardCalendarItem[]) =>
  items.reduce<CalendarOccurrence[]>((acc, item) => {
    const startDate = parseCalendarDate(item.startDate);
    const dueDate = parseCalendarDate(item.dueDate);

    if (startDate && dueDate) {
      if (isSameDay(startDate, dueDate)) {
        acc.push({
          id: `${item.cardId}:single:${getDayKey(startDate)}`,
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
      id: `${item.cardId}:single:${getDayKey(date)}`,
      kind: "single",
      date,
      item,
    });

    return acc;
  }, []);

const getRanges = (items: BoardCalendarItem[]) =>
  items.reduce<CalendarRange[]>((acc, item) => {
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

export const BoardCalendarView = ({ boardId, lists }: BoardCalendarViewProps) => {
  const router = useRouter();
  const cardModal = useCardModal();
  const queryClient = useQueryClient();
  const invalidateBoardCalendar = useBoardCalendarInvalidation(boardId);
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [anchorDate, setAnchorDate] = useState(() => new Date());
  const [expandedDayKey, setExpandedDayKey] = useState<string | null>(null);
  const [draggingOccurrenceId, setDraggingOccurrenceId] = useState<string | null>(null);
  const [dragOverDayKey, setDragOverDayKey] = useState<string | null>(null);
  const [createDialogDay, setCreateDialogDay] = useState<Date | null>(null);
  const [createTitle, setCreateTitle] = useState("");
  const [createListId, setCreateListId] = useState(() => lists[0]?.id ?? "");
  const suppressClickRef = useRef(false);
  const updateSuccessToastRef = useRef<string | null>(null);
  const { fromIso, toIso, days } = useMemo(
    () => viewMode === "month"
      ? getMonthGridRange(anchorDate)
      : getWeekGridRange(anchorDate),
    [anchorDate, viewMode],
  );

  const query = useQuery<BoardCalendarResponse>({
    queryKey: ["board-calendar", boardId, viewMode, fromIso, toIso],
    queryFn: () =>
      fetcher(
        `/api/boards/${boardId}/calendar?from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}`,
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

  const responseItems = query.data?.items;
  const items = useMemo(() => responseItems ?? [], [responseItems]);
  const occurrences = useMemo(() => getOccurrences(items), [items]);
  const ranges = useMemo(() => getRanges(items), [items]);
  const weekRows = useMemo(() => getWeekRows(days), [days]);
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
  const rangeLabel = `${format(new Date(fromIso), "dd/MM/yyyy", { locale: vi })} - ${format(new Date(toIso), "dd/MM/yyyy", { locale: vi })}`;
  const titleLabel = viewMode === "month" ? monthLabel : weekLabel;
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
    },
    onComplete: () => {
      setDraggingOccurrenceId(null);
      setDragOverDayKey(null);
    },
  });

  const { execute: executeCreateCard, fieldErrors: createFieldErrors, isLoading: isCreatingCard } = useAction(createCard, {
    onSuccess: (data) => {
      toast.success(`Đã tạo thẻ "${data.title}"`);
      setCreateDialogDay(null);
      setCreateTitle("");
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
    setAnchorDate((value) => viewMode === "month" ? subMonths(value, 1) : subWeeks(value, 1));
  };

  const goToNext = () => {
    setExpandedDayKey(null);
    setAnchorDate((value) => viewMode === "month" ? addMonths(value, 1) : addWeeks(value, 1));
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

    if (draggingOccurrenceId || isUpdatingCardDate || lists.length === 0) {
      return;
    }

    setExpandedDayKey(null);
    setCreateDialogDay(day);
    setCreateTitle("");
    setCreateListId((value) => value || lists[0]?.id || "");
  };

  const closeCreateDialog = (open: boolean) => {
    if (open) {
      return;
    }

    setCreateDialogDay(null);
    setCreateTitle("");
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

    executeCreateCard({
      title,
      boardId,
      listId: createListId,
      dueDate: getDefaultDueDateForDay(createDialogDay),
    });
  };

  const openCalendarCard = useCallback((
    cardId: string,
    event?: MouseEvent<HTMLButtonElement>,
  ) => {
    event?.stopPropagation();
    if (suppressClickRef.current) {
      return;
    }

    setExpandedDayKey(null);
    cardModal.onOpen(cardId);
  }, [cardModal]);

  const canClearStartDate = (occurrence: CalendarOccurrence) => (
    occurrence.kind === "start" ||
    occurrence.kind === "range" ||
    (occurrence.kind === "single" && !!occurrence.item.startDate)
  );

  const canClearDueDate = (occurrence: CalendarOccurrence) => (
    occurrence.kind === "due" ||
    occurrence.kind === "range" ||
    (occurrence.kind === "single" && !!occurrence.item.dueDate)
  );

  const toggleCalendarCardComplete = (occurrence: CalendarOccurrence) => {
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
    updateSuccessToastRef.current = "Đã xóa ngày bắt đầu";

    executeUpdateCard({
      id: occurrence.item.cardId,
      boardId,
      startDate: null,
    });
  };

  const clearCalendarDueDate = (occurrence: CalendarOccurrence) => {
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

  const handleOccurrenceDragStart = (
    event: DragEvent<HTMLDivElement>,
    occurrence: CalendarOccurrence,
  ) => {
    if (isUpdatingCardDate || occurrence.kind === "range") {
      event.preventDefault();
      return;
    }

    const payload: CalendarDragPayload = {
      occurrenceId: occurrence.id,
    };

    suppressClickRef.current = true;
    setDraggingOccurrenceId(occurrence.id);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("application/json", JSON.stringify(payload));
    event.dataTransfer.setData("text/plain", occurrence.id);
  };

  const handleOccurrenceDragEnd = () => {
    setDraggingOccurrenceId(null);
    setDragOverDayKey(null);
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);
  };

  const getDraggedOccurrence = (event: DragEvent<HTMLElement>) => {
    const payloadValue = event.dataTransfer.getData("application/json");

    if (payloadValue) {
      try {
        const payload = JSON.parse(payloadValue) as Partial<CalendarDragPayload>;

        if (payload.occurrenceId) {
          return occurrencesById[payload.occurrenceId] ?? null;
        }
      } catch {
        return null;
      }
    }

    const fallbackId = event.dataTransfer.getData("text/plain");

    return fallbackId ? occurrencesById[fallbackId] ?? null : null;
  };

  const updateOccurrenceDate = (occurrence: CalendarOccurrence, targetDay: Date) => {
    const { item } = occurrence;
    const currentStartDate = parseCalendarDate(item.startDate);
    const currentDueDate = parseCalendarDate(item.dueDate);
    const targetDayKey = getDayKey(targetDay);
    const sourceDayKey = getDayKey(occurrence.date);

    if (targetDayKey === sourceDayKey) {
      handleOccurrenceDragEnd();
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

  const handleDayDragOver = (event: DragEvent<HTMLDivElement>, dayKey: string) => {
    if (!draggingOccurrenceId) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDragOverDayKey(dayKey);
  };

  const handleDayDrop = (event: DragEvent<HTMLDivElement>, day: Date) => {
    event.preventDefault();
    suppressClickRef.current = true;

    const occurrence = getDraggedOccurrence(event);

    if (!occurrence) {
      toast.error("Không thể xác định thẻ đang kéo.");
      invalidateBoardCalendar();
      handleOccurrenceDragEnd();
      return;
    }

    updateOccurrenceDate(occurrence, day);
  };

  const renderQuickActionsMenu = (occurrence: CalendarOccurrence) => (
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
        {canClearStartDate(occurrence) && (
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
        {canClearDueDate(occurrence) && (
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

  const renderOccurrence = (
    occurrence: CalendarOccurrence,
    className?: string,
  ) => (
    <div
      key={occurrence.id}
      draggable={!isUpdatingCardDate && occurrence.kind !== "range"}
      onDragStart={(event) => handleOccurrenceDragStart(event, occurrence)}
      onDragEnd={handleOccurrenceDragEnd}
      title={occurrence.kind === "range" ? getRangeLabel(occurrence.item) : `${occurrence.item.title} - ${occurrence.item.listTitle}`}
      className={cn(
        "group/event flex h-7 w-full min-w-0 items-center gap-x-1 rounded-md border px-1.5 text-left text-[11px] font-medium leading-none transition",
        occurrence.kind === "range" ? "cursor-default" : "cursor-grab active:cursor-grabbing",
        getOccurrenceTone(occurrence),
        draggingOccurrenceId === occurrence.id && "opacity-60 ring-2 ring-violet-300",
        isUpdatingCardDate && "cursor-wait opacity-70",
        className,
      )}
    >
      <button
        type="button"
        onClick={(event) => openCalendarCard(occurrence.item.cardId, event)}
        aria-label={`Mở thẻ ${occurrence.item.title}`}
        className="flex h-full min-w-0 flex-1 items-center gap-x-1 text-left"
      >
        {occurrence.item.labels[0] && (
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: occurrence.item.labels[0].color }}
          />
        )}
        <span className="hidden shrink-0 text-[10px] font-semibold uppercase tracking-wide opacity-70 md:inline">
          {getOccurrenceLabel(occurrence)}
        </span>
        <span className="truncate">{occurrence.item.title}</span>
      </button>
      {occurrence.item.isCompleted && (
        <CheckCircle2 className="h-3 w-3 shrink-0 opacity-80" />
      )}
      {renderQuickActionsMenu(occurrence)}
    </div>
  );

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

    return (
      <div
        key={segment.id}
        style={style}
        title={getRangeLabel(segment.range.item)}
        className={cn(
          "group/event absolute z-10 h-7 min-w-0 px-0.5",
          mode === "week" && "hidden md:block",
        )}
      >
        <div
          className={cn(
            "flex h-full min-w-0 items-center gap-x-1 border px-1.5 text-left text-[11px] font-medium leading-none shadow-sm transition",
            getOccurrenceTone(occurrence),
            segment.isRangeStart ? "rounded-l-md" : "rounded-l-none border-l-0",
            segment.isRangeEnd ? "rounded-r-md" : "rounded-r-none border-r-0",
            isUpdatingCardDate && "cursor-wait opacity-70",
          )}
        >
          <button
            type="button"
            onClick={(event) => openCalendarCard(segment.range.item.cardId, event)}
            aria-label={`Mở thẻ ${segment.range.item.title}`}
            className="flex h-full min-w-0 flex-1 items-center gap-x-1 text-left"
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
            <span className="truncate">{segment.range.item.title}</span>
            {!segment.isRangeEnd && (
              <span className="shrink-0 text-[10px] font-semibold opacity-70">↦</span>
            )}
          </button>
          {segment.range.item.isCompleted && (
            <CheckCircle2 className="h-3 w-3 shrink-0 opacity-80" />
          )}
          {renderQuickActionsMenu(occurrence)}
        </div>
      </div>
    );
  };

  const renderRangeOverflows = (
    weekDays: Date[],
    segments: CalendarRangeSegment[],
    maxLanes: number,
    mode: ViewMode,
  ) => {
    if (mode === "week" && typeof window !== "undefined" && window.innerWidth < 768) {
      return null;
    }

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

    return (
      <div
        key={dayKey}
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
          draggingOccurrenceId && "ring-inset ring-violet-100",
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
                "flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-xs font-semibold text-neutral-600",
                viewMode === "month" && !isSameMonth(day, currentMonth) && "text-neutral-400",
                isToday(day) && "bg-violet-600 text-white",
              )}
            >
              {viewMode === "week" ? format(day, "dd/MM") : format(day, "d")}
            </span>
          </div>
          <button
            type="button"
            onClick={(event) => openCreateDialog(day, event)}
            disabled={lists.length === 0 || isCreatingCard || isUpdatingCardDate}
            title={lists.length === 0 ? "Tạo danh sách trước khi thêm thẻ từ lịch" : `Thêm thẻ vào ngày ${format(day, "dd/MM/yyyy")}`}
            aria-label={lists.length === 0 ? "Tạo danh sách trước khi thêm thẻ từ lịch" : `Thêm thẻ vào ngày ${format(day, "dd/MM/yyyy")}`}
            className={cn(
              "flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-neutral-400 opacity-100 transition hover:bg-violet-50 hover:text-violet-700 focus-visible:bg-violet-50 focus-visible:text-violet-700 disabled:cursor-not-allowed disabled:opacity-30 md:opacity-0 md:group-hover/day:opacity-100 md:focus-visible:opacity-100",
              isToday(day) && "text-violet-700",
            )}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        <div
          style={
            viewMode === "month"
              ? (pt > 0 ? { paddingTop: `${pt}px` } : undefined)
              : (pt > 0 ? { "--pt-desktop": `${pt}px` } as any : undefined)
          }
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
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-white/20 bg-white/95 shadow-xl backdrop-blur">
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
            <div className="flex h-8 shrink-0 items-center rounded-lg border border-neutral-200 bg-white p-0.5 shadow-sm">
              {(["month", "week"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => changeViewMode(mode)}
                  className={cn(
                    "h-7 rounded-md px-3 text-xs font-semibold text-neutral-600 transition hover:bg-neutral-100",
                    viewMode === mode && "bg-violet-600 text-white shadow-sm hover:bg-violet-600",
                  )}
                >
                  {mode === "month" ? "Tháng" : "Tuần"}
                </button>
              ))}
            </div>

            <div className="flex h-8 shrink-0 items-center rounded-lg border border-neutral-200 bg-white p-0.5 shadow-sm">
              <button
                type="button"
                onClick={goToPrevious}
                className="flex h-7 w-7 items-center justify-center rounded-md text-neutral-600 transition hover:bg-neutral-100"
                aria-label={viewMode === "month" ? "Tháng trước" : "Tuần trước"}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={goToToday}
                className="h-7 rounded-md px-2 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100"
              >
                Hôm nay
              </button>
              <button
                type="button"
                onClick={goToNext}
                className="flex h-7 w-7 items-center justify-center rounded-md text-neutral-600 transition hover:bg-neutral-100"
                aria-label={viewMode === "month" ? "Tháng sau" : "Tuần sau"}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
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

        {query.isLoading && (
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
            ) : (
              renderCalendarWeekRow(weekRows[0] ?? days, 0, "week")
            )}

            {items.length === 0 && (
              <div className="mt-3 flex min-h-[96px] flex-col items-center justify-center rounded-lg border border-dashed border-neutral-300 bg-neutral-50 px-4 text-center">
                <CalendarDays className="mb-2 h-6 w-6 text-neutral-400" />
                <p className="text-sm font-semibold text-neutral-700">
                  Chưa có thẻ nào trong khoảng thời gian này.
                </p>
                <p className="mt-1 max-w-md text-xs text-neutral-500">
                  Các thẻ có ngày bắt đầu hoặc ngày hết hạn sẽ xuất hiện trong lịch.
                </p>
              </div>
            )}

            {expandedDayKey && expandedDayItems.length > 0 && (
              <div className="mt-3 rounded-lg border border-neutral-200 bg-white p-3 shadow-sm">
                <div className="mb-2 flex items-center justify-between gap-x-2">
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
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {expandedDayItems.map((occurrence) => (
                    <div
                      key={`expanded:${occurrence.id}`}
                      title={`${occurrence.item.title} - ${occurrence.item.listTitle}`}
                      className="group/event flex min-w-0 items-start gap-x-2 rounded-lg border border-neutral-200 bg-neutral-50 p-2 text-left transition hover:border-violet-200 hover:bg-violet-50"
                    >
                      <button
                        type="button"
                        onClick={(event) => openCalendarCard(occurrence.item.cardId, event)}
                        aria-label={`Mở thẻ ${occurrence.item.title}`}
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
                            <span>{getOccurrenceLabel(occurrence)}</span>
                            <span className="truncate">{occurrence.item.listTitle}</span>
                            {occurrence.item.assignees.length > 0 && (
                              <span className="inline-flex items-center gap-x-1">
                                <UsersRound className="h-3.5 w-3.5" />
                                {occurrence.item.assignees.length}
                              </span>
                            )}
                            {occurrence.item.commentCount > 0 && (
                              <span className="inline-flex items-center gap-x-1">
                                <MessageSquare className="h-3.5 w-3.5" />
                                {occurrence.item.commentCount}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                      {renderQuickActionsMenu(occurrence)}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </section>
    <Dialog open={!!createDialogDay} onOpenChange={closeCreateDialog}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Thêm thẻ vào ngày {selectedCreateDayLabel}</DialogTitle>
          <DialogDescription>
            Thẻ mới sẽ có hạn lúc {String(DEFAULT_CREATE_HOUR).padStart(2, "0")}:00 theo giờ địa phương.
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
