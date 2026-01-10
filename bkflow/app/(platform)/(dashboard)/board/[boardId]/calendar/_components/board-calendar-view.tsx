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
  format,
  isSameDay,
  isSameMonth,
  isToday,
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
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  ListChecks,
  MessageSquare,
  Plus,
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
  DAY_TIME_SLOTS,
  GMT7_OFFSET_MINUTES,
  MAX_DAY_LANES,
  MAX_MOBILE_DAY_LANES,
  MIN_CREATE_DURATION_MS,
  MINUTES_IN_DAY,
  MONTH_RANGE_LANES,
  MONTH_VISIBLE_DESKTOP,
  MONTH_VISIBLE_MOBILE,
  RANGE_LANE_GAP,
  RANGE_LANE_HEIGHT,
  WEEK_DAYS,
  WEEK_RANGE_LANES,
  WEEK_VISIBLE_DESKTOP,
  WEEK_VISIBLE_MOBILE,
} from "./board-calendar/constants";
import { CalendarOccurrenceItem } from "./board-calendar/calendar-occurrence";
import { CalendarRangeSegmentItem } from "./board-calendar/calendar-range-segment";
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
  getGmt7Parts,
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
  getDayViewBlockContext,
  getDayViewBlockStyle,
  getDayViewBlockTimeLabel,
  getDayViewBlockTone,
  getDayViewBlockTooltip,
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
import type {
  BoardCalendarAccessPayload,
  BoardCalendarRealtimePayload,
  BoardCalendarViewProps,
  CalendarDragPayload,
  CalendarMarkerListStyle,
  CalendarOccurrence,
  CalendarRange,
  CalendarRangeSegment,
  CalendarResizeEdge,
  CalendarResizeState,
  DayViewBlock,
  DayViewCreateSelectionState,
  DayViewOverflowGroup,
  DayViewResizeState,
  PositionedDayViewBlock,
  UnscheduledCardDragPayload,
  ViewMode,
} from "./board-calendar/types";

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
    if (!processRealtimeEvent(payload)) {
      return;
    }

    invalidateBoardCalendar();
  }, [invalidateBoardCalendar, processRealtimeEvent]);
  const handleCalendarRealtimeWithRefresh = useCallback((payload: BoardCalendarRealtimePayload) => {
    if (!processRealtimeEvent(payload)) {
      return;
    }

    invalidateBoardCalendar();
    router.refresh();
  }, [invalidateBoardCalendar, processRealtimeEvent, router]);
  const handleBoardDeletedRealtime = useCallback((payload: BoardCalendarAccessPayload) => {
    if (!processRealtimeEvent(payload)) {
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

    if (!title || title.length < 3) {
      toast.error("Tiêu đề quá ngắn (tối thiểu 3 ký tự).");
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
            <CalendarOccurrenceItem
              key={occurrence.id}
              occurrence={occurrence}
              variant={variant}
              className="md:hidden"
              draggingOccurrenceId={draggingOccurrenceId}
              isUpdatingCardDate={isUpdatingCardDate}
              isUpdatingChecklistItemDueDate={isUpdatingChecklistItemDueDate}
              canClearStartDate={canClearStartDate}
              canClearDueDate={canClearDueDate}
              onOpenCard={openCalendarCard}
              onOpenCardDirect={openCalendarCardDirect}
              onDragStart={handleOccurrenceDragStart}
              onDragEnd={handleOccurrenceDragEnd}
              onQuickActionClick={handleQuickActionClick}
              onToggleComplete={toggleCalendarCardComplete}
              onClearStartDate={clearCalendarStartDate}
              onClearDueDate={clearCalendarDueDate}
            />,
          )}
          {dayOccurrences.slice(0, maxVisibleDesktop).map((occurrence, occurrenceIndex) =>
            <CalendarOccurrenceItem
              key={occurrence.id}
              occurrence={occurrence}
              variant={variant}
              className={occurrenceIndex >= maxVisibleMobile ? "hidden sm:flex" : undefined}
              draggingOccurrenceId={draggingOccurrenceId}
              isUpdatingCardDate={isUpdatingCardDate}
              isUpdatingChecklistItemDueDate={isUpdatingChecklistItemDueDate}
              canClearStartDate={canClearStartDate}
              canClearDueDate={canClearDueDate}
              onOpenCard={openCalendarCard}
              onOpenCardDirect={openCalendarCardDirect}
              onDragStart={handleOccurrenceDragStart}
              onDragEnd={handleOccurrenceDragEnd}
              onQuickActionClick={handleQuickActionClick}
              onToggleComplete={toggleCalendarCardComplete}
              onClearStartDate={clearCalendarStartDate}
              onClearDueDate={clearCalendarDueDate}
            />,
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
          data-calendar-day-view-block="true"
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
                data-calendar-day-view-resize-handle="true"
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
                data-calendar-day-view-resize-handle="true"
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
            data-calendar-day-view-overflow="true"
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
            onPointerDown={isSkeleton ? undefined : handleDayViewCreatePointerDown}
            onPointerMove={isSkeleton ? undefined : handleDayViewCreatePointerMove}
            onPointerUp={isSkeleton ? undefined : handleDayViewCreatePointerEnd}
            onPointerCancel={isSkeleton ? undefined : resetDayViewCreateSelection}
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

            {!isSkeleton && dayViewCreatePreview && (
              <div
                className="pointer-events-none absolute left-1 right-1 z-20 rounded-md border border-violet-400 bg-violet-100/60 shadow-[inset_0_0_0_1px_rgba(139,92,246,0.16)]"
                style={{
                  top: `${(dayViewCreatePreview.startMinute / MINUTES_IN_DAY) * 100}%`,
                  height: `${((dayViewCreatePreview.endMinute - dayViewCreatePreview.startMinute) / MINUTES_IN_DAY) * 100}%`,
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
                  renderDayViewBlock(
                    block,
                    "flex md:hidden left-[var(--day-block-left)] w-[var(--day-block-width)]",
                    "mobile",
                  ),
                )}
                {mobileDayViewLayout.overflowGroups.map((group) =>
                  renderDayOverflowGroup(group, "block md:hidden", "mobile"),
                )}
              </div>
            )}

            {isCurrentGmt7Day && (
              <div
                data-calendar-current-time-indicator="true"
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
        {segments.map((segment) => (
          <CalendarRangeSegmentItem
            key={segment.id}
            segment={segment}
            maxLanes={maxLanes}
            mode={mode}
            variant={variant}
            resizingRange={resizingRange}
            draggingOccurrenceId={draggingOccurrenceId}
            draggingUnscheduledCardId={draggingUnscheduledCardId}
            draggingBoardCardId={draggingBoardCardId}
            draggingDayViewBlockId={draggingDayViewBlockId}
            isUpdatingCardDate={isUpdatingCardDate}
            canClearStartDate={canClearStartDate}
            canClearDueDate={canClearDueDate}
            onOpenCard={openCalendarCard}
            onOpenCardDirect={openCalendarCardDirect}
            onRangeResizeStart={handleRangeResizeStart}
            onRangeResizeMove={handleRangeResizeMove}
            onRangeResizeEnd={handleRangeResizeEnd}
            onRangeResizeCancel={resetRangeResize}
            onQuickActionClick={handleQuickActionClick}
            onToggleComplete={toggleCalendarCardComplete}
            onClearStartDate={clearCalendarStartDate}
            onClearDueDate={clearCalendarDueDate}
          />
        ))}
        {renderRangeOverflows(weekDays, segments, maxLanes, mode)}
      </div>
    );
  };

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
    {renderUnscheduledPanel()}
    </div>
    <Dialog open={!!createDialogDay} onOpenChange={closeCreateDialog}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Thêm thẻ vào {selectedCreateDayLabel}</DialogTitle>
          <DialogDescription>
            Chọn danh sách và khoảng thời gian theo GMT+7.
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
            <label htmlFor="calendar-card-start" className="text-xs font-semibold text-neutral-600">
              Bắt đầu
            </label>
            <input
              id="calendar-card-start"
              type="datetime-local"
              step={60}
              value={createStartValue}
              onChange={(event) => setCreateStartValue(event.target.value)}
              disabled={isCreatingCard}
              className="h-9 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-800 shadow-sm outline-none transition focus:border-violet-400 focus:ring-1 focus:ring-violet-200 disabled:cursor-not-allowed disabled:bg-neutral-50"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="calendar-card-due" className="text-xs font-semibold text-neutral-600">
              Kết thúc
            </label>
            <input
              id="calendar-card-due"
              type="datetime-local"
              step={60}
              value={createDueValue}
              onChange={(event) => setCreateDueValue(event.target.value)}
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
