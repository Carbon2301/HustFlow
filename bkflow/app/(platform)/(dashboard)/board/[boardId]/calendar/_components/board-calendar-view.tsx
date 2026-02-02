"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
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
  format,
  isSameDay,
  startOfMonth,
  subDays,
  subMonths,
  subWeeks,
} from "date-fns";
import { vi } from "date-fns/locale";
import {
  AlertCircle,
  CalendarDays,
  CalendarX2,
  ChevronLeft,
  ChevronRight,
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
import { realtimeChannels } from "@/lib/realtime/channels";
import { isRealtimeClientConfigured } from "@/lib/realtime/client";
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
  BoardCalendarResponse,
  BoardCalendarUnscheduledCard,
} from "@/types";
import {
  GMT7_OFFSET_MINUTES,
  MAX_DAY_LANES,
  MAX_MOBILE_DAY_LANES,
  MIN_CREATE_DURATION_MS,
  MINUTES_IN_DAY,
  MONTH_VISIBLE_DESKTOP,
  MONTH_VISIBLE_MOBILE,
  WEEK_DAYS,
  WEEK_VISIBLE_DESKTOP,
  WEEK_VISIBLE_MOBILE,
} from "./board-calendar/constants";
import { CalendarWeekRow } from "./board-calendar/calendar-week-row";
import {
  copyDateToDay,
  formatDayTitle,
  formatGmt7DateTimeInput,
  getCreateRangeFromDayViewMinutes,
  getDateWithPreservedTime,
  getDayGridRange,
  getDayKey,
  getDefaultCreateRangeForDay,
  getDefaultDueDateForDay,
  getGmt7DayBoundary,
  getGmt7DayKey,
  getMonthGridRange,
  getReminderError,
  getRoundedCreateRangeFromDayViewMinutes,
  getWeekGridRange,
  parseCalendarDate,
  parseGmt7DateTimeInput,
  roundDayViewEndMinute,
  roundDayViewStartMinute,
} from "./board-calendar/date-utils";
import {
  getDayViewBlocks,
  getOverlappingDayBlockLayout,
} from "./board-calendar/day-view-layout";
import {
  isCalendarCardItem,
  isCalendarChecklistItem,
  isOverdue,
} from "./board-calendar/item-utils";
import {
  getOccurrences,
  getRanges,
  getRangeOccurrencesByDay,
  getRangeSegmentsForWeeks,
  getWeekRows,
} from "./board-calendar/range-layout";
import { ExpandedOccurrence } from "./board-calendar/expanded-occurrence";
import { BoardCalendarRealtimeSubscriptions } from "./board-calendar/realtime-subscriptions";
import { CreateCardDialog } from "./board-calendar/create-card-dialog";
import { DayViewTimeGrid } from "./board-calendar/day-view-time-grid";
import { UnscheduledPanel } from "./board-calendar/unscheduled-panel";
import type {
  BoardCalendarAccessPayload,
  BoardCalendarRealtimePayload,
  BoardCalendarViewProps,
  CalendarDragPayload,
  CalendarOccurrence,
  CalendarRange,
  CalendarResizeEdge,
  CalendarResizeState,
  DayViewBlock,
  DayViewCreateSelectionState,
  DayViewResizeState,
  PositionedDayViewBlock,
  ViewMode,
} from "./board-calendar/types";

type SchedulableCardPayload = {
  cardId: string;
  isCompleted: boolean;
};

export const BoardCalendarView = ({
  boardId,
  lists,
  currentUserId,
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
  const [dayViewCreateSelection, setDayViewCreateSelection] =
    useState<DayViewCreateSelectionState | null>(null);
  const [openDayOverflowGroupId, setOpenDayOverflowGroupId] = useState<string | null>(null);
  const [createDialogDay, setCreateDialogDay] = useState<Date | null>(null);
  const [createTitle, setCreateTitle] = useState("");
  const [createStartValue, setCreateStartValue] = useState("");
  const [createDueValue, setCreateDueValue] = useState("");
  const [createListId, setCreateListId] = useState(() => lists[0]?.id ?? "");
  const [isUnscheduledCollapsed, setIsUnscheduledCollapsed] = useState(defaultUnscheduledCollapsed);
  const suppressClickRef = useRef(false);
  const updateSuccessToastRef = useRef<string | null>(null);
  const updatingChecklistItemCardIdRef = useRef<string | null>(null);
  const dayViewDragSlotOffsetRef = useRef(0);
  const processedRealtimeEventIdsRef = useRef<Set<string>>(new Set());
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
  const processRealtimeEvent = useCallback((
    payload: BoardCalendarRealtimePayload,
    options: { skipOwnEcho?: boolean } = {},
  ) => {
    if (payload.boardId !== boardId) {
      return false;
    }

    if (processedRealtimeEventIdsRef.current.has(payload.eventId)) {
      return false;
    }

    processedRealtimeEventIdsRef.current.add(payload.eventId);

    return options.skipOwnEcho === false || payload.actorUserId !== currentUserId;
  }, [boardId, currentUserId]);
  const handleCalendarRealtime = useCallback((payload: BoardCalendarRealtimePayload) => {
    if (!processRealtimeEvent(payload, { skipOwnEcho: false })) {
      return;
    }

    invalidateBoardCalendar();
  }, [invalidateBoardCalendar, processRealtimeEvent]);
  const handleCalendarRealtimeWithRefresh = useCallback((payload: BoardCalendarRealtimePayload) => {
    if (!processRealtimeEvent(payload, { skipOwnEcho: false })) {
      return;
    }

    invalidateBoardCalendar();
    router.refresh();
  }, [invalidateBoardCalendar, processRealtimeEvent, router]);
  const handleBoardDeletedRealtime = useCallback((payload: BoardCalendarAccessPayload) => {
    if (!processRealtimeEvent(payload, { skipOwnEcho: false })) {
      return;
    }

    toast.error("Bảng này đã bị xóa.");
    cardModal.onClose();
    router.push(`/organization/${payload.orgId}`);
  }, [cardModal, processRealtimeEvent, router]);
  const handleAccessRevokedRealtime = useCallback((payload: BoardCalendarAccessPayload) => {
    if (!processRealtimeEvent(payload, { skipOwnEcho: false })) {
      return;
    }

    if (payload.targetUserId === currentUserId) {
      toast.error("Bạn không còn quyền truy cập bảng này.");
      cardModal.onClose();
      router.push(`/organization/${payload.orgId}`);
      return;
    }

    if (payload.actorUserId === currentUserId) {
      return;
    }

    invalidateBoardCalendar();
    router.refresh();
  }, [cardModal, currentUserId, invalidateBoardCalendar, processRealtimeEvent, router]);

  // Calendar data derived from the API response and active board filters.
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

  // Lookup maps used by drag/drop, day expansion, and range rendering.
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
  const dayViewCreatePreview = dayViewCreateSelection
    ? getCreateRangeFromDayViewMinutes(
      anchorDate,
      dayViewCreateSelection.anchorMinute,
      dayViewCreateSelection.currentMinute,
    )
    : null;

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
      setCreateStartValue("");
      setCreateDueValue("");
      setDayViewCreateSelection(null);
      suppressClickRef.current = false;
      invalidateBoardCalendar();
      queryClient.invalidateQueries({ queryKey: ["card", data.id] });
      router.refresh();
      cardModal.onOpen(data.id);
    },
    onError: (error) => {
      toast.error(error);
      setCreateDialogDay(null);
      setCreateTitle("");
      setCreateStartValue("");
      setCreateDueValue("");
      setDayViewCreateSelection(null);
      suppressClickRef.current = false;
      invalidateBoardCalendar();
      void query.refetch();
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

  const openCreateDialogWithRange = (startDate: Date, dueDate: Date) => {
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
    setCreateDialogDay(startDate);
    setCreateTitle("");
    setCreateStartValue(formatGmt7DateTimeInput(startDate));
    setCreateDueValue(formatGmt7DateTimeInput(dueDate));
    setCreateListId((value) =>
      lists.some((list) => list.id === value) ? value : lists[0]?.id || "",
    );
  };

  const openCreateDialog = (day: Date, event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    const range = getDefaultCreateRangeForDay(day);

    openCreateDialogWithRange(range.startDate, range.dueDate);
  };

  const closeCreateDialog = (open: boolean) => {
    if (open) {
      return;
    }

    setCreateDialogDay(null);
    setCreateTitle("");
    setCreateStartValue("");
    setCreateDueValue("");
    setDayViewCreateSelection(null);
    suppressClickRef.current = false;
  };

  const submitCreateCard = () => {
    const title = createTitle.trim();

    if (!title || title.length < 1) {
      toast.error("Tiêu đề quá ngắn (tối thiểu 1 ký tự).");
      return;
    }

    if (!createListId) {
      toast.error("Vui lòng chọn danh sách đích.");
      return;
    }

    const startDate = parseGmt7DateTimeInput(createStartValue);
    const dueDate = parseGmt7DateTimeInput(createDueValue);

    if (!startDate || !dueDate) {
      toast.error("Khoảng thời gian tạo thẻ không hợp lệ.");
      return;
    }

    if (dueDate.getTime() <= startDate.getTime()) {
      toast.error("Ngày kết thúc phải sau ngày bắt đầu.");
      return;
    }

    if (dueDate.getTime() - startDate.getTime() < MIN_CREATE_DURATION_MS) {
      toast.error("Khoảng thời gian tối thiểu là 15 phút.");
      return;
    }

    executeCreateCard({
      title,
      boardId,
      listId: createListId,
      startDate,
      dueDate,
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

  const openCalendarCardDirect = useCallback((
    cardId: string,
    options?: { checklistItemId?: string },
  ) => {
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
    setDayViewCreateSelection(null);
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
    setDayViewCreateSelection(null);
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
      const nextDueDate = new Date(targetDate.getTime() + 30 * 60_000);

      if (currentDueDate.getTime() === nextDueDate.getTime()) {
        resetCalendarDragState();
        return;
      }

      updateSuccessToastRef.current = "Đã di chuyển thẻ";

      executeUpdateCard({
        id: block.item.cardId,
        boardId,
        dueDate: nextDueDate,
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

  const scheduleCardForDay = (
    card: SchedulableCardPayload,
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

  const scheduleCardAtDate = (
    card: SchedulableCardPayload,
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
      scheduleCardForDay(unscheduledCard, day);
      return;
    }

    const boardCard = getDraggedBoardCard(event);

    if (boardCard) {
      scheduleCardForDay(boardCard, day);
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
      scheduleCardAtDate(unscheduledCard, startDate);
      return;
    }

    const boardCard = getDraggedBoardCard(event);

    if (boardCard) {
      scheduleCardAtDate(boardCard, startDate);
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

  const isDesktopDayViewCreatePointer = (event: PointerEvent<HTMLDivElement>) =>
    event.pointerType !== "touch" &&
    window.matchMedia("(min-width: 768px)").matches;

  const isBlockedDayViewCreateTarget = (target: EventTarget | null) => {
    if (!(target instanceof Element)) {
      return true;
    }

    return !!target.closest(
      [
        "button",
        "a",
        "input",
        "select",
        "textarea",
        "[role='button']",
        "[data-calendar-day-view-block]",
        "[data-calendar-day-view-resize-handle]",
        "[data-calendar-day-view-overflow]",
        "[data-calendar-current-time-indicator]",
        "[data-rbd-draggable-id]",
        "[draggable='true']",
      ].join(","),
    );
  };

  const getDayViewMinuteFromPointer = (
    event: PointerEvent<HTMLDivElement>,
    gridElement: HTMLDivElement,
  ) => {
    const rect = gridElement.getBoundingClientRect();
    const rawMinute =
      ((event.clientY - rect.top) / DAY_VIEW_SLOT_HEIGHT) * 15;

    return Math.min(Math.max(Math.round(rawMinute), 0), MINUTES_IN_DAY);
  };

  const canStartDayViewCreateSelection = (
    event: PointerEvent<HTMLDivElement>,
  ) => (
    isDesktopDayViewCreatePointer(event) &&
    !isBlockedDayViewCreateTarget(event.target) &&
    !draggingOccurrenceId &&
    !draggingUnscheduledCardId &&
    !draggingBoardCardId &&
    !draggingDayViewBlockId &&
    !resizingRange &&
    !resizingDayViewBlock &&
    !dayViewCreateSelection &&
    !isUpdatingCardDate &&
    !isUpdatingChecklistItemDueDate &&
    !isCreatingCard &&
    lists.length > 0
  );

  const handleDayViewCreatePointerDown = (
    event: PointerEvent<HTMLDivElement>,
  ) => {
    if (!canStartDayViewCreateSelection(event)) {
      return;
    }

    const minute = getDayViewMinuteFromPointer(event, event.currentTarget);

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    suppressClickRef.current = true;
    setExpandedDayKey(null);
    setOpenDayOverflowGroupId(null);
    setDayViewCreateSelection({
      pointerId: event.pointerId,
      anchorMinute: minute,
      currentMinute: minute,
    });
  };

  const handleDayViewCreatePointerMove = (
    event: PointerEvent<HTMLDivElement>,
  ) => {
    if (
      !dayViewCreateSelection ||
      dayViewCreateSelection.pointerId !== event.pointerId
    ) {
      return;
    }

    const minute = getDayViewMinuteFromPointer(event, event.currentTarget);

    event.preventDefault();
    event.stopPropagation();
    setDayViewCreateSelection((value) => value
      ? {
        ...value,
        currentMinute: minute,
      }
      : value);
  };

  const resetDayViewCreateSelection = () => {
    setDayViewCreateSelection(null);
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);
  };

  const handleDayViewCreatePointerEnd = (
    event: PointerEvent<HTMLDivElement>,
  ) => {
    if (
      !dayViewCreateSelection ||
      dayViewCreateSelection.pointerId !== event.pointerId
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    const range = getRoundedCreateRangeFromDayViewMinutes(
      anchorDate,
      dayViewCreateSelection.anchorMinute,
      dayViewCreateSelection.currentMinute,
    );

    setDayViewCreateSelection(null);
    openCreateDialogWithRange(range.startDate, range.dueDate);
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);
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

    if (edge === "start") {
      const roundedTargetMinute = roundDayViewStartMinute(targetMinute);
      const targetDate = getDayViewDateAtMinute(roundedTargetMinute);

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

    const roundedTargetMinute = roundDayViewEndMinute(targetMinute);
    const targetDate = getDayViewDateAtMinute(roundedTargetMinute);

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

  const handleUnscheduledCardClick = (card: BoardCalendarUnscheduledCard) => {
    if (suppressClickRef.current) {
      return;
    }

    cardModal.onOpen(card.cardId);
  };

  const renderCalendarDayTimeGrid = (isSkeleton = false) => (
    <DayViewTimeGrid
      anchorDate={anchorDate}
      currentTime={currentTime}
      isSkeleton={isSkeleton}
      dayViewBlocks={dayViewBlocks}
      desktopDayViewLayout={desktopDayViewLayout}
      mobileDayViewLayout={mobileDayViewLayout}
      dayViewCreatePreview={dayViewCreatePreview}
      openDayOverflowGroupId={openDayOverflowGroupId}
      resizingDayViewBlock={resizingDayViewBlock}
      dragOverDaySlotIndex={dragOverDaySlotIndex}
      dragOverDayMinute={dragOverDayMinute}
      draggingDayViewBlockId={draggingDayViewBlockId}
      isUpdatingCardDate={isUpdatingCardDate}
      isUpdatingChecklistItemDueDate={isUpdatingChecklistItemDueDate}
      onOpenDayOverflowGroupChange={setOpenDayOverflowGroupId}
      onOpenCard={openCalendarCard}
      onDayViewBlockDragStart={handleDayViewBlockDragStart}
      onDayViewBlockDragEnd={handleDayViewBlockDragEnd}
      onDayViewBlockResizeStart={handleDayViewBlockResizeStart}
      onDayViewBlockResizeMove={handleDayViewBlockResizeMove}
      onDayViewBlockResizeEnd={handleDayViewBlockResizeEnd}
      onDayViewBlockResizeCancel={resetDayViewBlockResize}
      onDayViewCreatePointerDown={handleDayViewCreatePointerDown}
      onDayViewCreatePointerMove={handleDayViewCreatePointerMove}
      onDayViewCreatePointerEnd={handleDayViewCreatePointerEnd}
      onDayViewCreatePointerCancel={resetDayViewCreateSelection}
      onDayViewDragOver={handleDayViewDragOver}
      onDayViewDragLeave={handleDayViewDragLeave}
      onDayViewDrop={handleDayViewDrop}
    />
  );



  return (
    <>
    <BoardCalendarRealtimeSubscriptions
      channelName={realtimeChannelName}
      enabled={realtimeEnabled}
      onInvalidate={handleCalendarRealtime}
      onRefresh={handleCalendarRealtimeWithRefresh}
      onBoardDeleted={handleBoardDeletedRealtime}
      onAccessRevoked={handleAccessRevokedRealtime}
    />
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
                {weekRows.map((weekDays, weekIndex) => (
                  <CalendarWeekRow
                    key={`week-row:${weekIndex}`}
                    weekDays={weekDays}
                    weekIndex={weekIndex}
                    mode="month"
                    weekRowsLength={weekRows.length}
                    viewMode={viewMode}
                    variant={variant}
                    currentMonth={currentMonth}
                    maxVisibleDesktop={maxVisibleDesktop}
                    maxVisibleMobile={maxVisibleMobile}
                    listsCount={lists.length}
                    isCreatingCard={isCreatingCard}
                    isUpdatingCardDate={isUpdatingCardDate}
                    isUpdatingChecklistItemDueDate={isUpdatingChecklistItemDueDate}
                    draggingOccurrenceId={draggingOccurrenceId}
                    draggingUnscheduledCardId={draggingUnscheduledCardId}
                    draggingBoardCardId={draggingBoardCardId}
                    draggingDayViewBlockId={draggingDayViewBlockId}
                    dragOverDayKey={dragOverDayKey}
                    resizingRange={resizingRange}
                    occurrencesByDay={occurrencesByDay}
                    rangeOccurrencesByDay={rangeOccurrencesByDay}
                    rangeSegmentsByWeek={rangeSegmentsByWeek}
                    canClearStartDate={canClearStartDate}
                    canClearDueDate={canClearDueDate}
                    onOpenCard={openCalendarCard}
                    onOpenCardDirect={openCalendarCardDirect}
                    onOccurrenceDragStart={handleOccurrenceDragStart}
                    onOccurrenceDragEnd={handleOccurrenceDragEnd}
                    onQuickActionClick={handleQuickActionClick}
                    onToggleComplete={toggleCalendarCardComplete}
                    onClearStartDate={clearCalendarStartDate}
                    onClearDueDate={clearCalendarDueDate}
                    onOpenCreateDialog={openCreateDialog}
                    onSetExpandedDayKey={setExpandedDayKey}
                    onDayDragOver={handleDayDragOver}
                    onDayDrop={handleDayDrop}
                    onDayDragLeave={(dayKey) =>
                      setDragOverDayKey((value) => value === dayKey ? null : value)
                    }
                    onRangeResizeStart={handleRangeResizeStart}
                    onRangeResizeMove={handleRangeResizeMove}
                    onRangeResizeEnd={handleRangeResizeEnd}
                    onRangeResizeCancel={resetRangeResize}
                  />
                ))}
              </div>
            ) : viewMode === "week" ? (
              <CalendarWeekRow
                weekDays={weekRows[0] ?? days}
                weekIndex={0}
                mode="week"
                weekRowsLength={weekRows.length}
                viewMode={viewMode}
                variant={variant}
                currentMonth={currentMonth}
                maxVisibleDesktop={maxVisibleDesktop}
                maxVisibleMobile={maxVisibleMobile}
                listsCount={lists.length}
                isCreatingCard={isCreatingCard}
                isUpdatingCardDate={isUpdatingCardDate}
                isUpdatingChecklistItemDueDate={isUpdatingChecklistItemDueDate}
                draggingOccurrenceId={draggingOccurrenceId}
                draggingUnscheduledCardId={draggingUnscheduledCardId}
                draggingBoardCardId={draggingBoardCardId}
                draggingDayViewBlockId={draggingDayViewBlockId}
                dragOverDayKey={dragOverDayKey}
                resizingRange={resizingRange}
                occurrencesByDay={occurrencesByDay}
                rangeOccurrencesByDay={rangeOccurrencesByDay}
                rangeSegmentsByWeek={rangeSegmentsByWeek}
                canClearStartDate={canClearStartDate}
                canClearDueDate={canClearDueDate}
                onOpenCard={openCalendarCard}
                onOpenCardDirect={openCalendarCardDirect}
                onOccurrenceDragStart={handleOccurrenceDragStart}
                onOccurrenceDragEnd={handleOccurrenceDragEnd}
                onQuickActionClick={handleQuickActionClick}
                onToggleComplete={toggleCalendarCardComplete}
                onClearStartDate={clearCalendarStartDate}
                onClearDueDate={clearCalendarDueDate}
                onOpenCreateDialog={openCreateDialog}
                onSetExpandedDayKey={setExpandedDayKey}
                onDayDragOver={handleDayDragOver}
                onDayDrop={handleDayDrop}
                onDayDragLeave={(dayKey) =>
                  setDragOverDayKey((value) => value === dayKey ? null : value)
                }
                onRangeResizeStart={handleRangeResizeStart}
                onRangeResizeMove={handleRangeResizeMove}
                onRangeResizeEnd={handleRangeResizeEnd}
                onRangeResizeCancel={resetRangeResize}
              />
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
                        {cards.map((occurrence) => (
                          <ExpandedOccurrence
                            key={`expanded:${occurrence.id}`}
                            occurrence={occurrence}
                            isUpdatingCardDate={isUpdatingCardDate}
                            canClearStartDate={canClearStartDate}
                            canClearDueDate={canClearDueDate}
                            onOpenCard={openCalendarCard}
                            onOpenCardDirect={openCalendarCardDirect}
                            onQuickActionClick={handleQuickActionClick}
                            onToggleComplete={toggleCalendarCardComplete}
                            onClearStartDate={clearCalendarStartDate}
                            onClearDueDate={clearCalendarDueDate}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {checklistItems.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400">Checklist</h4>
                      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                        {checklistItems.map((occurrence) => (
                          <ExpandedOccurrence
                            key={`expanded:${occurrence.id}`}
                            occurrence={occurrence}
                            isUpdatingCardDate={isUpdatingCardDate}
                            canClearStartDate={canClearStartDate}
                            canClearDueDate={canClearDueDate}
                            onOpenCard={openCalendarCard}
                            onOpenCardDirect={openCalendarCardDirect}
                            onQuickActionClick={handleQuickActionClick}
                            onToggleComplete={toggleCalendarCardComplete}
                            onClearStartDate={clearCalendarStartDate}
                            onClearDueDate={clearCalendarDueDate}
                          />
                        ))}
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
    <UnscheduledPanel
      lists={lists}
      variant={variant}
      isCollapsed={isUnscheduledCollapsed}
      setIsCollapsed={setIsUnscheduledCollapsed}
      filtersAreActive={filtersAreActive}
      selectedListIds={filters.selectedListIds}
      unscheduledCards={unscheduledCards}
      filteredUnscheduledCards={filteredUnscheduledCards}
      isLoading={query.isLoading}
      isError={query.isError}
      isSuccess={query.isSuccess}
      isUpdatingCardDate={isUpdatingCardDate}
      isUpdatingChecklistItemDueDate={isUpdatingChecklistItemDueDate}
      draggingUnscheduledCardId={draggingUnscheduledCardId}
      onSelectedListIdsChange={(listIds) => setSelectedLists(boardId, listIds)}
      onCardClick={handleUnscheduledCardClick}
      onCardDragStart={handleUnscheduledCardDragStart}
      onCardDragEnd={handleUnscheduledCardDragEnd}
    />
    </div>
    <CreateCardDialog
      open={!!createDialogDay}
      selectedDayLabel={selectedCreateDayLabel}
      title={createTitle}
      startValue={createStartValue}
      dueValue={createDueValue}
      listId={createListId}
      lists={lists}
      fieldErrors={createFieldErrors}
      isLoading={isCreatingCard}
      onOpenChange={closeCreateDialog}
      onTitleChange={setCreateTitle}
      onStartValueChange={setCreateStartValue}
      onDueValueChange={setCreateDueValue}
      onListIdChange={setCreateListId}
      onSubmit={submitCreateCard}
    />
    </>
  );
};
