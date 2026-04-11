"use client";

import {
  type CSSProperties,
  type PointerEvent,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { BoardMemberRole } from "@prisma/client";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  eachDayOfInterval,
  eachMonthOfInterval,
  eachWeekOfInterval,
  format,
  isAfter,
  isBefore,
  isToday,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { vi } from "date-fns/locale";
import {
  AlertTriangle,
  CalendarX2,
  CalendarClock,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { updateCard } from "@/actions/update-card";
import { Hint } from "@/components/hint";
import { useAction } from "@/hooks/use-action";
import { useCardModal } from "@/hooks/use-card-modal";
import { getDateTimezoneOffset } from "@/lib/date-utils";
import { realtimeChannels } from "@/lib/realtime/channels";
import { isRealtimeClientConfigured } from "@/lib/realtime/client";
import type { RealtimeQueryInvalidation } from "@/lib/realtime/types";
import { cn } from "@/lib/utils";
import type {
  BoardTimelineBoardMember,
  BoardTimelineCard,
  BoardTimelineList,
} from "@/types";

import { BoardTimelineRealtimeSubscriptions } from "./realtime-subscriptions";

type BoardTimelineViewProps = {
  boardId: string;
  lists: BoardTimelineList[];
  boardMembers: BoardTimelineBoardMember[];
  currentUserId: string;
  currentBoardMemberId: string;
  currentMemberRole: BoardMemberRole;
};

type TimelineZoom = "day" | "week" | "month";

type TimelineUnit = {
  key: string;
  label: string;
  start: Date;
  end: Date;
};

type ScheduledCard = {
  card: BoardTimelineCard;
  start: Date;
  end: Date;
  isMilestone: boolean;
  hasInvalidRange: boolean;
};

type TimelineInteractionMode = "move" | "resize-start" | "resize-end" | "move-milestone";
type TimelineSingleDateField = "startDate" | "dueDate";

type TimelineDateOverride = {
  startDate: string | null;
  dueDate: string | null;
};

type TimelineInteraction = {
  mode: TimelineInteractionMode;
  cardId: string;
  pointerId: number;
  pointerStartX: number;
  columnWidth: number;
  originalStartDate: Date;
  originalDueDate: Date;
  originalSingleDate?: Date;
  singleDateField?: TimelineSingleDateField;
  deltaUnits: number;
  hasMoved: boolean;
};

type DependencyLine = {
  key: string;
  sourceId: string;
  targetId: string;
  sourceTitle: string;
  targetTitle: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  hasConflict: boolean;
};

const ROW_HEIGHT = 48;
const HEADER_HEIGHT = 48;
const BAR_HEIGHT = 32;
const BAR_VERTICAL_OFFSET = (ROW_HEIGHT - BAR_HEIGHT) / 2;
const MIN_GRID_WIDTH = 520;
const GANTT_MAX_HEIGHT = "calc(100vh - 12rem)";

const zoomLabels: Record<TimelineZoom, string> = {
  day: "Ngày",
  week: "Tuần",
  month: "Tháng",
};

const COLUMN_WIDTH_BY_ZOOM: Record<TimelineZoom, number> = {
  day: 56,
  week: 96,
  month: 120,
};

const getRealtimePayloadField = <TValue,>(
  payload: unknown,
  field: string,
) => {
  if (!payload || typeof payload !== "object" || !(field in payload)) {
    return undefined;
  }

  return (payload as Record<string, TValue>)[field];
};

const getRealtimePayloadEventId = (payload: unknown) =>
  getRealtimePayloadField<string>(payload, "eventId");

const getRealtimePayloadCardId = (payload: unknown) =>
  getRealtimePayloadField<string>(payload, "cardId");

const getRealtimePayloadTargetUserId = (payload: unknown) =>
  getRealtimePayloadField<string>(payload, "targetUserId");

const getRealtimePayloadInvalidations = (payload: unknown) =>
  getRealtimePayloadField<RealtimeQueryInvalidation[]>(payload, "invalidate") ?? [];

const parseTimelineDate = (value: string | null) => {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return startOfDay(date);
};

const parseCardDateTime = (value: string | null) => {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
};

const formatDate = (value: string | null) => {
  const date = parseTimelineDate(value);

  if (!date) {
    return "Chưa đặt";
  }

  return format(date, "dd/MM/yyyy", { locale: vi });
};

const getCardSchedule = (card: BoardTimelineCard): ScheduledCard | null => {
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

const getUnitForDate = (units: TimelineUnit[], date: Date) => {
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

const getTimelinePlacement = (
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

const getTimelineUnits = (
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

const getTimelineBounds = (cards: ScheduledCard[]) => {
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

const isCardOverdue = (card: BoardTimelineCard) => {
  const dueDate = parseTimelineDate(card.dueDate);

  return Boolean(dueDate && isBefore(dueDate, startOfDay(new Date())) && !card.isCompleted);
};

const getCardTimelineTitle = (row: ScheduledCard) => {
  const prefix = row.hasInvalidRange ? "Khoảng ngày cần kiểm tra: " : "";

  if (row.isMilestone) {
    return `${prefix}${row.card.title} - Mốc ${formatDate(row.card.startDate ?? row.card.dueDate)}`;
  }

  return `${prefix}${row.card.title} - ${formatDate(row.card.startDate)} đến ${formatDate(row.card.dueDate)}`;
};

const getCardTone = (card: BoardTimelineCard, hasInvalidRange: boolean) => {
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

const shiftTimelineDate = (
  date: Date,
  deltaUnits: number,
  zoom: TimelineZoom,
) => {
  if (zoom === "month") {
    return addMonths(date, deltaUnits);
  }

  return addDays(date, zoom === "week" ? deltaUnits * 7 : deltaUnits);
};

const getInteractionDateRange = (
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

const getInteractionDateOverride = (
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

const hasSameDateRange = (
  leftStartDate: Date,
  leftDueDate: Date,
  rightStartDate: Date,
  rightDueDate: Date,
) => (
  leftStartDate.getTime() === rightStartDate.getTime() &&
  leftDueDate.getTime() === rightDueDate.getTime()
);

const applyTimelineDateOverrides = (
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

const getDependencyConflicts = (card: BoardTimelineCard) => {
  const blockeeStart = parseCardDateTime(card.startDate);

  if (!blockeeStart) {
    return [];
  }

  return card.blockedByDependencies.filter((blocker) => {
    const blockerDue = parseCardDateTime(blocker.dueDate);

    return Boolean(blockerDue && !blocker.isCompleted && isAfter(blockerDue, blockeeStart));
  });
};

const getDependencyPreview = (card: BoardTimelineCard) => {
  const conflictCount = getDependencyConflicts(card).length;

  return {
    unresolvedBlockerCount: card.unresolvedBlockerCount,
    conflictCount,
    hasBlockers: card.unresolvedBlockerCount > 0,
    hasConflict: conflictCount > 0,
  };
};

const getDependencyPreviewLabel = (card: BoardTimelineCard) => {
  const preview = getDependencyPreview(card);
  const parts = [];

  if (preview.hasBlockers) {
    parts.push(`${preview.unresolvedBlockerCount} thẻ chặn chưa hoàn thành`);
  }

  if (preview.hasConflict) {
    parts.push(`${preview.conflictCount} xung đột lịch phụ thuộc`);
  }

  return parts.join(". ");
};

const hasDependencyLineConflict = (
  sourceCard: BoardTimelineCard,
  targetCard: BoardTimelineCard,
) => {
  const sourceDueDate = parseCardDateTime(sourceCard.dueDate);
  const targetStartDate = parseCardDateTime(targetCard.startDate);

  return Boolean(
    sourceDueDate &&
    targetStartDate &&
    !sourceCard.isCompleted &&
    isAfter(sourceDueDate, targetStartDate),
  );
};

const getUnscheduledCardMeta = (card: BoardTimelineCard) => {
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

const TimelineToolbar = ({
  zoom,
  onZoomChange,
}: {
  zoom: TimelineZoom;
  onZoomChange: (zoom: TimelineZoom) => void;
}) => (
  <div className="flex items-center gap-1 rounded-lg border border-neutral-200 bg-white p-1">
    {(Object.keys(zoomLabels) as TimelineZoom[]).map((option) => (
      <button
        key={option}
        type="button"
        onClick={() => onZoomChange(option)}
        className={cn(
          "h-8 cursor-pointer rounded-md px-3 text-xs font-semibold text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-950",
          zoom === option && "bg-violet-600 text-white shadow-sm hover:bg-violet-600 hover:text-white",
        )}
      >
        {zoomLabels[option]}
      </button>
    ))}
  </div>
);

const DependencyPreviewBadge = ({
  card,
  className,
  style,
}: {
  card: BoardTimelineCard;
  className?: string;
  style?: CSSProperties;
}) => {
  const preview = getDependencyPreview(card);

  if (!preview.hasBlockers && !preview.hasConflict) {
    return null;
  }

  const label = getDependencyPreviewLabel(card);

  return (
    <Hint description={label} side="top">
      <span
        aria-label={label}
        className={cn(
          "inline-flex h-5 shrink-0 items-center gap-1 rounded-md px-1.5 text-xs font-semibold",
          preview.hasConflict
            ? "bg-rose-50 text-rose-600 ring-1 ring-rose-200"
            : "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
          className,
        )}
        style={style}
      >
        {preview.hasConflict && <AlertTriangle className="h-3 w-3" aria-hidden="true" />}
        <span>{preview.unresolvedBlockerCount}</span>
        {preview.hasConflict && (
          <span className="sr-only">, {preview.conflictCount} xung dot lich phu thuoc</span>
        )}
      </span>
    </Hint>
  );
};

const TimelineGrid = ({
  rows,
  units,
  zoom,
  onOpenCard,
  onBarPointerDown,
  canEdit,
  updatingCardId,
  activeInteraction,
  scrollContainerRef,
}: {
  rows: ScheduledCard[];
  units: TimelineUnit[];
  zoom: TimelineZoom;
  onOpenCard: (cardId: string) => void;
  onBarPointerDown: (
    event: PointerEvent<HTMLElement>,
    row: ScheduledCard,
    mode: TimelineInteractionMode,
    columnWidth: number,
  ) => void;
  canEdit: boolean;
  updatingCardId: string | null;
  activeInteraction: TimelineInteraction | null;
  scrollContainerRef: RefObject<HTMLDivElement | null>;
}) => {
  const columnWidth = COLUMN_WIDTH_BY_ZOOM[zoom];
  const gridWidth = Math.max(units.length * columnWidth, MIN_GRID_WIDTH);
  const gridHeight = rows.length * ROW_HEIGHT;
  const gridContentRef = useRef<HTMLDivElement | null>(null);
  const cardNodeRefs = useRef(new Map<string, HTMLButtonElement>());
  const [dependencyLines, setDependencyLines] = useState<DependencyLine[]>([]);
  const rowsByCardId = useMemo(() => (
    new Map(rows.map((row) => [row.card.id, row]))
  ), [rows]);
  const setCardNodeRef = useCallback((
    cardId: string,
    node: HTMLButtonElement | null,
  ) => {
    if (node) {
      cardNodeRefs.current.set(cardId, node);
      return;
    }

    cardNodeRefs.current.delete(cardId);
  }, []);
  const measureDependencyLines = useCallback(() => {
    const gridContent = gridContentRef.current;

    if (!gridContent) {
      setDependencyLines([]);
      return;
    }

    const contentRect = gridContent.getBoundingClientRect();
    const nextLines: DependencyLine[] = [];

    rows.forEach((sourceRow) => {
      const sourceNode = cardNodeRefs.current.get(sourceRow.card.id);

      if (!sourceNode) {
        return;
      }

      sourceRow.card.blockingDependencies.forEach((dependency) => {
        const targetRow = rowsByCardId.get(dependency.cardId);

        if (!targetRow) {
          return;
        }

        const targetNode = cardNodeRefs.current.get(targetRow.card.id);

        if (!targetNode) {
          return;
        }

        const sourceRect = sourceNode.getBoundingClientRect();
        const targetRect = targetNode.getBoundingClientRect();

        nextLines.push({
          key: `${sourceRow.card.id}:${dependency.id}:${targetRow.card.id}`,
          sourceId: sourceRow.card.id,
          targetId: targetRow.card.id,
          sourceTitle: sourceRow.card.title,
          targetTitle: targetRow.card.title,
          x1: sourceRect.right - contentRect.left,
          y1: sourceRect.top - contentRect.top + sourceRect.height / 2,
          x2: targetRect.left - contentRect.left,
          y2: targetRect.top - contentRect.top + targetRect.height / 2,
          hasConflict: hasDependencyLineConflict(sourceRow.card, targetRow.card),
        });
      });
    });

    setDependencyLines(nextLines);
  }, [rows, rowsByCardId]);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(measureDependencyLines);

    return () => window.cancelAnimationFrame(frameId);
  }, [
    activeInteraction,
    gridHeight,
    gridWidth,
    measureDependencyLines,
    units,
    updatingCardId,
    zoom,
  ]);

  useEffect(() => {
    let frameId: number | null = null;
    const scheduleMeasure = () => {
      if (frameId !== null) {
        return;
      }

      frameId = window.requestAnimationFrame(() => {
        frameId = null;
        measureDependencyLines();
      });
    };
    const resizeObserver = new ResizeObserver(scheduleMeasure);
    const gridContent = gridContentRef.current;
    const scrollContainer = scrollContainerRef.current;

    if (gridContent) {
      resizeObserver.observe(gridContent);
    }

    if (scrollContainer) {
      resizeObserver.observe(scrollContainer);
      scrollContainer.addEventListener("scroll", scheduleMeasure, { passive: true });
    }

    scheduleMeasure();

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }

      resizeObserver.disconnect();
      scrollContainer?.removeEventListener("scroll", scheduleMeasure);
    };
  }, [measureDependencyLines, scrollContainerRef]);

  return (
    <div className="min-w-0 flex-1">
      <div
        className="sticky top-0 z-10 grid border-b border-neutral-200 bg-white"
        style={{
          height: HEADER_HEIGHT,
          width: gridWidth,
          gridTemplateColumns: `repeat(${units.length}, ${columnWidth}px)`,
        }}
      >
        {units.map((unit) => (
          <div
            key={unit.key}
            className={cn(
              "flex items-center border-r border-neutral-200 px-2 text-xs font-semibold text-neutral-500",
              isToday(unit.start) && "bg-blue-50 text-blue-700",
            )}
          >
            {unit.label}
          </div>
        ))}
      </div>
      <div
        ref={gridContentRef}
        className="relative"
        style={{ width: gridWidth, minHeight: gridHeight }}
      >
        {dependencyLines.length > 0 && (
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-10 overflow-visible"
            width={gridWidth}
            height={gridHeight}
            viewBox={`0 0 ${gridWidth} ${gridHeight}`}
          >
            <defs>
              <marker
                id="timeline-dependency-arrow"
                viewBox="0 0 8 8"
                refX="7"
                refY="4"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 8 4 L 0 8 z" className="fill-sky-400" />
              </marker>
              <marker
                id="timeline-dependency-conflict-arrow"
                viewBox="0 0 8 8"
                refX="7"
                refY="4"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 8 4 L 0 8 z" className="fill-rose-500" />
              </marker>
            </defs>
            {dependencyLines.map((line) => {
              const controlOffset = Math.max(40, Math.abs(line.x2 - line.x1) / 2);
              const path = [
                `M ${line.x1} ${line.y1}`,
                `C ${line.x1 + controlOffset} ${line.y1}`,
                `${line.x2 - controlOffset} ${line.y2}`,
                `${line.x2} ${line.y2}`,
              ].join(" ");

              return (
                <g key={line.key}>
                  <path
                    d={path}
                    fill="none"
                    strokeWidth={line.hasConflict ? 2.25 : 1.75}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    markerEnd={`url(#${line.hasConflict
                      ? "timeline-dependency-conflict-arrow"
                      : "timeline-dependency-arrow"})`}
                    className={cn(
                      line.hasConflict
                        ? "stroke-rose-500"
                        : "stroke-sky-400/70",
                    )}
                  />
                  {line.hasConflict && (
                    <g transform={`translate(${line.x2 - 18} ${line.y2 - 18})`}>
                      <circle r="8" cx="8" cy="8" className="fill-rose-50 stroke-rose-500" />
                      <path
                        d="M8 4.5v4.25M8 11.25h.01"
                        fill="none"
                        strokeLinecap="round"
                        strokeWidth="1.7"
                        className="stroke-rose-600"
                      />
                    </g>
                  )}
                </g>
              );
            })}
          </svg>
        )}
        {rows.map((row) => {
          const placement = getTimelinePlacement(row, units, columnWidth);
          const tone = getCardTone(row.card, row.hasInvalidRange);
          const title = getCardTimelineTitle(row);
          const canDragMilestone = Boolean(
            row.isMilestone &&
            (row.card.startDate || row.card.dueDate) &&
            updatingCardId !== row.card.id,
          );
          const canDragRange = Boolean(
            row.card.startDate &&
            row.card.dueDate &&
            !row.isMilestone &&
            !row.hasInvalidRange &&
            updatingCardId !== row.card.id,
          );
          const isDragging = activeInteraction?.cardId === row.card.id;

          return (
            <div
              key={row.card.id}
              className="relative border-b border-neutral-100 bg-white"
              style={{ height: ROW_HEIGHT }}
            >
              <div
                aria-hidden="true"
                className="absolute inset-0 grid"
                style={{ gridTemplateColumns: `repeat(${units.length}, ${columnWidth}px)` }}
              >
                {units.map((unit) => (
                  <div
                    key={unit.key}
                    className={cn(
                      "border-r border-neutral-100",
                      isToday(unit.start) && "bg-blue-50/60",
                    )}
                  />
                ))}
              </div>
              {row.isMilestone ? (
                <>
                  <Hint description={title} side="top">
                    <button
                      ref={(node) => setCardNodeRef(row.card.id, node)}
                      type="button"
                      onClick={() => onOpenCard(row.card.id)}
                      onPointerDown={(event) => {
                        if (row.card.startDate || row.card.dueDate) {
                          onBarPointerDown(event, row, "move-milestone", columnWidth);
                        }
                      }}
                      className={cn(
                        "absolute top-1/2 z-20 h-4 w-4 cursor-pointer touch-none -translate-y-1/2 rotate-45 rounded-[3px] border shadow-sm transition hover:scale-110",
                        tone,
                        canEdit && canDragMilestone && "cursor-grab active:cursor-grabbing",
                        isDragging && "opacity-80 shadow-lg ring-2 ring-neutral-900/10",
                        updatingCardId === row.card.id && "cursor-wait opacity-70",
                      )}
                      style={{ left: placement.left + columnWidth / 2 - 8 }}
                    >
                      <span className="sr-only">{row.card.title}</span>
                    </button>
                  </Hint>
                  <DependencyPreviewBadge
                    card={row.card}
                    className="absolute top-1/2 -translate-y-1/2"
                    style={{ left: placement.left + columnWidth / 2 + 12 }}
                  />
                </>
              ) : (
                <Hint description={title} side="top">
                  <button
                    ref={(node) => setCardNodeRef(row.card.id, node)}
                    type="button"
                    onClick={() => onOpenCard(row.card.id)}
                    onPointerDown={(event) => {
                      if (row.card.startDate && row.card.dueDate && !row.isMilestone) {
                        onBarPointerDown(event, row, "move", columnWidth);
                      }
                    }}
                    className={cn(
                      "absolute z-20 flex cursor-pointer touch-none items-center gap-1.5 overflow-hidden rounded-md border px-2 text-left text-xs font-semibold shadow-sm transition hover:shadow-md",
                      tone,
                      canEdit && canDragRange && "cursor-grab active:cursor-grabbing",
                      isDragging && "z-10 opacity-80 shadow-lg ring-2 ring-neutral-900/10",
                      updatingCardId === row.card.id && "cursor-wait opacity-70",
                    )}
                    style={{
                      top: BAR_VERTICAL_OFFSET,
                      height: BAR_HEIGHT,
                      left: placement.left + 6,
                      width: Math.max(36, placement.width - 12),
                    }}
                  >
                    {canEdit && canDragRange && (
                      <span
                        aria-hidden="true"
                        onPointerDown={(event) => onBarPointerDown(
                          event,
                          row,
                          "resize-start",
                          columnWidth,
                        )}
                        className="absolute inset-y-1 left-0 w-2 cursor-ew-resize rounded-l-md bg-black/10 opacity-0 transition hover:opacity-100"
                      />
                    )}
                    <span className="truncate">{row.card.title}</span>
                    {row.hasInvalidRange && <AlertTriangle className="h-3 w-3 shrink-0" />}
                    <DependencyPreviewBadge card={row.card} className="ml-auto" />
                    {canEdit && canDragRange && (
                      <span
                        aria-hidden="true"
                        onPointerDown={(event) => onBarPointerDown(
                          event,
                          row,
                          "resize-end",
                          columnWidth,
                        )}
                        className="absolute inset-y-1 right-0 w-2 cursor-ew-resize rounded-r-md bg-black/10 opacity-0 transition hover:opacity-100"
                      />
                    )}
                  </button>
                </Hint>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const EmptyTimeline = ({ hasCards }: { hasCards: boolean }) => (
  <div className="flex min-h-[320px] items-center justify-center rounded-lg border border-dashed border-neutral-300 bg-white p-6 text-center">
    <div>
      <CalendarClock className="mx-auto h-10 w-10 text-neutral-300" />
      <h2 className="mt-3 text-base font-semibold text-neutral-900">
        {hasCards ? "Chưa có thẻ có mốc thời gian" : "Chưa có thẻ để hiển thị"}
      </h2>
      <p className="mt-1 max-w-md text-sm text-neutral-500">
        {hasCards
          ? "Các thẻ chưa lên lịch được gom ở phần bên dưới để chuẩn bị kéo vào timeline ở phase sau."
          : "Khi board có thẻ, timeline sẽ dùng dữ liệu ngày, nhãn, thành viên và phụ thuộc tại đây."}
      </p>
    </div>
  </div>
);

const UnscheduledDrawer = ({
  cards,
  isOpen,
  onClose,
  onOpenCard,
}: {
  cards: BoardTimelineCard[];
  isOpen: boolean;
  onClose: () => void;
  onOpenCard: (cardId: string) => void;
}) => {
  if (!isOpen) {
    return null;
  }

  return (
    <aside className="absolute inset-y-3 right-3 z-40 flex w-[min(360px,calc(100%-1.5rem))] flex-col overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-xl">
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-neutral-100 px-4 py-3">
        <div className="flex min-w-0 items-start gap-2">
          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-violet-50 text-violet-700">
            <CalendarX2 className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-neutral-900">Chưa lên lịch</h2>
            <p className="mt-1 text-xs text-neutral-500">Thẻ chưa có ngày bắt đầu và hạn hoàn thành.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng danh sách chưa lên lịch"
          className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-3">
        {cards.length === 0 ? (
          <p className="rounded-lg border border-dashed border-neutral-200 px-3 py-4 text-sm text-neutral-400">
            Không có thẻ chưa lên lịch.
          </p>
        ) : (
          <div className="space-y-2">
            {cards.map((card) => (
              <Hint key={card.id} description={`Mở thẻ: ${card.title}`} side="left">
                <button
                  type="button"
                  onClick={() => onOpenCard(card.id)}
                  aria-label={`Mở thẻ: ${card.title}`}
                  className="w-full cursor-pointer rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-left transition hover:border-neutral-300 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className={cn(
                        "truncate text-sm font-semibold text-neutral-900",
                        card.isCompleted && "text-neutral-500 line-through",
                      )}>
                        {card.title}
                      </p>
                      <p className="mt-1 truncate text-xs text-neutral-500">{card.listTitle}</p>
                    </div>
                    <DependencyPreviewBadge card={card} />
                  </div>
                  {getUnscheduledCardMeta(card).length > 0 && (
                    <p className="mt-2 truncate text-xs text-neutral-500">
                      {getUnscheduledCardMeta(card).join(" • ")}
                    </p>
                  )}
                  {card.labels.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {card.labels.slice(0, 4).map((label) => (
                        <Hint
                          key={label.id}
                          description={label.title || "Nhãn"}
                          side="top"
                        >
                          <span
                            className="h-1.5 w-8 rounded-full"
                            style={{ backgroundColor: label.color }}
                          />
                        </Hint>
                      ))}
                    </div>
                  )}
                </button>
              </Hint>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
};

export const BoardTimelineView = ({
  boardId,
  lists,
  currentUserId,
  currentMemberRole,
}: BoardTimelineViewProps) => {
  const [zoom, setZoom] = useState<TimelineZoom>("day");
  const [dateOverrides, setDateOverrides] = useState<Record<string, TimelineDateOverride>>({});
  const [interaction, setInteraction] = useState<TimelineInteraction | null>(null);
  const [updatingCardId, setUpdatingCardId] = useState<string | null>(null);
  const [isUnscheduledPanelOpen, setIsUnscheduledPanelOpen] = useState(false);
  const interactionRef = useRef<TimelineInteraction | null>(null);
  const suppressOpenCardIdRef = useRef<string | null>(null);
  const pendingUpdateCardIdRef = useRef<string | null>(null);
  const processedEventIdsRef = useRef(new Set<string>());
  const realtimeRefreshTimerRef = useRef<number | null>(null);
  const pendingRealtimeRefreshRef = useRef(false);
  const ganttScrollContainerRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();
  const queryClient = useQueryClient();
  const cardModal = useCardModal();
  const canEditTimeline = currentMemberRole !== BoardMemberRole.VIEWER;
  const realtimeChannelName = realtimeChannels.board(boardId);
  const realtimeEnabled = isRealtimeClientConfigured();
  const setActiveInteraction = (nextInteraction: TimelineInteraction | null) => {
    interactionRef.current = nextInteraction;
    setInteraction(nextInteraction);
  };
  const timelineLists = useMemo(
    () => applyTimelineDateOverrides(lists, dateOverrides),
    [lists, dateOverrides],
  );
  const { execute: executeUpdateCard } = useAction(updateCard, {
    onSuccess: (data) => {
      setDateOverrides((current) => {
        const next = { ...current };
        delete next[data.id];
        return next;
      });
      setUpdatingCardId(null);
      pendingUpdateCardIdRef.current = null;
      toast.success("Đã cập nhật ngày");
      queryClient.invalidateQueries({ queryKey: ["card", data.id] });
      queryClient.invalidateQueries({ queryKey: ["card-logs", data.id] });
      router.refresh();
    },
    onError: (error) => {
      const cardId = pendingUpdateCardIdRef.current;

      if (cardId) {
        setDateOverrides((current) => {
          const next = { ...current };
          delete next[cardId];
          return next;
        });
      }

      setUpdatingCardId(null);
      pendingUpdateCardIdRef.current = null;
      toast.error(error);
    },
    onComplete: () => {
      setActiveInteraction(null);
    },
  });

  const markRealtimeEventProcessed = useCallback((payload: unknown) => {
    const eventId = getRealtimePayloadEventId(payload);

    if (!eventId) {
      return true;
    }

    const processedEventIds = processedEventIdsRef.current;

    if (processedEventIds.has(eventId)) {
      return false;
    }

    if (processedEventIds.size > 200) {
      processedEventIds.clear();
    }

    processedEventIds.add(eventId);
    return true;
  }, []);

  const invalidateRealtimeQueries = useCallback((payload: unknown) => {
    getRealtimePayloadInvalidations(payload).forEach(({ queryKey }) => {
      queryClient.invalidateQueries({ queryKey });
    });
  }, [queryClient]);

  const clearRealtimeOptimisticState = useCallback((payload: unknown) => {
    const cardId = getRealtimePayloadCardId(payload);

    if (!cardId) {
      return;
    }

    if (pendingUpdateCardIdRef.current === cardId) {
      pendingUpdateCardIdRef.current = null;
      setUpdatingCardId(null);
    }

    setDateOverrides((current) => {
      if (!current[cardId]) {
        return current;
      }

      const next = { ...current };
      delete next[cardId];
      return next;
    });
  }, []);

  const scheduleTimelineRefresh = useCallback((
    payload?: unknown,
    options: { force?: boolean } = {},
  ) => {
    if (payload) {
      invalidateRealtimeQueries(payload);
      clearRealtimeOptimisticState(payload);
    }

    if (!options.force && interactionRef.current) {
      pendingRealtimeRefreshRef.current = true;
      return;
    }

    if (realtimeRefreshTimerRef.current !== null) {
      return;
    }

    realtimeRefreshTimerRef.current = window.setTimeout(() => {
      realtimeRefreshTimerRef.current = null;
      router.refresh();
    }, 150);
  }, [clearRealtimeOptimisticState, invalidateRealtimeQueries, router]);

  const handleTimelineRefresh = useCallback((payload: unknown) => {
    if (!markRealtimeEventProcessed(payload)) {
      return;
    }

    scheduleTimelineRefresh(payload);
  }, [markRealtimeEventProcessed, scheduleTimelineRefresh]);

  const handleTimelineAccessRevoked = useCallback((payload: unknown) => {
    if (!markRealtimeEventProcessed(payload)) {
      return;
    }

    const targetUserId = getRealtimePayloadTargetUserId(payload);

    if (targetUserId === currentUserId) {
      toast.error("Quyền truy cập bảng đã thay đổi.");
      scheduleTimelineRefresh(payload, { force: true });
      return;
    }

    scheduleTimelineRefresh(payload);
  }, [currentUserId, markRealtimeEventProcessed, scheduleTimelineRefresh]);

  const handleTimelineBoardDeleted = useCallback((payload: unknown) => {
    if (!markRealtimeEventProcessed(payload)) {
      return;
    }

    toast.error("Bảng này không còn khả dụng.");
    scheduleTimelineRefresh(payload, { force: true });
  }, [markRealtimeEventProcessed, scheduleTimelineRefresh]);

  useEffect(() => () => {
    if (realtimeRefreshTimerRef.current !== null) {
      window.clearTimeout(realtimeRefreshTimerRef.current);
    }
  }, []);

  useEffect(() => {
    if (interaction || !pendingRealtimeRefreshRef.current) {
      return;
    }

    pendingRealtimeRefreshRef.current = false;

    if (realtimeRefreshTimerRef.current !== null) {
      return;
    }

    realtimeRefreshTimerRef.current = window.setTimeout(() => {
      realtimeRefreshTimerRef.current = null;
      router.refresh();
    }, 150);
  }, [interaction, router]);

  const openCard = (cardId: string) => {
    if (suppressOpenCardIdRef.current === cardId) {
      suppressOpenCardIdRef.current = null;
      return;
    }

    cardModal.onOpen(cardId);
  };

  const handleBarPointerDown = (
    event: PointerEvent<HTMLElement>,
    row: ScheduledCard,
    mode: TimelineInteractionMode,
    columnWidth: number,
  ) => {
    if (!canEditTimeline) {
      toast.error("Bạn cần quyền chỉnh sửa để cập nhật timeline.");
      return;
    }

    if (updatingCardId) {
      return;
    }

    if (row.hasInvalidRange) {
      toast.error("Khoảng ngày chưa hợp lệ. Hãy sửa trong thẻ trước khi kéo.");
      return;
    }

    const originalStartDate = parseCardDateTime(row.card.startDate);
    const originalDueDate = parseCardDateTime(row.card.dueDate);

    if (mode === "move-milestone") {
      const singleDateField: TimelineSingleDateField | null = originalStartDate && !originalDueDate
        ? "startDate"
        : !originalStartDate && originalDueDate
          ? "dueDate"
          : null;
      const originalSingleDate = singleDateField === "startDate"
        ? originalStartDate
        : originalDueDate;

      if (!singleDateField || !originalSingleDate) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.setPointerCapture?.(event.pointerId);
      setActiveInteraction({
        mode,
        cardId: row.card.id,
        pointerId: event.pointerId,
        pointerStartX: event.clientX,
        columnWidth,
        originalStartDate: originalStartDate ?? originalSingleDate,
        originalDueDate: originalDueDate ?? originalSingleDate,
        originalSingleDate,
        singleDateField,
        deltaUnits: 0,
        hasMoved: false,
      });
      return;
    }

    if (!originalStartDate || !originalDueDate || row.isMilestone) {
      return;
    }

    if (mode !== "move") {
      suppressOpenCardIdRef.current = row.card.id;
    }

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setActiveInteraction({
      mode,
      cardId: row.card.id,
      pointerId: event.pointerId,
      pointerStartX: event.clientX,
      columnWidth,
      originalStartDate,
      originalDueDate,
      deltaUnits: 0,
      hasMoved: false,
    });
  };

  const removeDateOverride = (cardId: string) => {
    setDateOverrides((current) => {
      const next = { ...current };
      delete next[cardId];
      return next;
    });
  };

  useEffect(() => {
    if (!interaction) {
      return undefined;
    }

    const handlePointerMove = (event: globalThis.PointerEvent) => {
      const currentInteraction = interactionRef.current;

      if (!currentInteraction || event.pointerId !== currentInteraction.pointerId) {
        return;
      }

      const nextDeltaUnits = Math.round(
        (event.clientX - currentInteraction.pointerStartX) / currentInteraction.columnWidth,
      );

      if (nextDeltaUnits === currentInteraction.deltaUnits) {
        return;
      }

      const nextInteraction = {
        ...currentInteraction,
        deltaUnits: nextDeltaUnits,
        hasMoved: currentInteraction.hasMoved || nextDeltaUnits !== 0,
      };
      const nextOverride = getInteractionDateOverride(nextInteraction, zoom);

      suppressOpenCardIdRef.current = currentInteraction.cardId;
      setActiveInteraction(nextInteraction);
      setDateOverrides((current) => ({
        ...current,
        [currentInteraction.cardId]: nextOverride,
      }));
    };

    const handlePointerEnd = (event: globalThis.PointerEvent) => {
      const currentInteraction = interactionRef.current;

      if (!currentInteraction || event.pointerId !== currentInteraction.pointerId) {
        return;
      }

      if (!currentInteraction.hasMoved) {
        setActiveInteraction(null);
        return;
      }

      const nextRange = getInteractionDateRange(currentInteraction, zoom);

      if (
        currentInteraction.mode !== "move-milestone" &&
        isAfter(nextRange.startDate, nextRange.dueDate)
      ) {
        removeDateOverride(currentInteraction.cardId);
        setActiveInteraction(null);
        toast.error("Ngày bắt đầu phải trước hoặc bằng ngày hết hạn.");
        return;
      }

      const hasNoDateChange = currentInteraction.mode === "move-milestone"
        ? (
          currentInteraction.originalSingleDate?.getTime() ===
            (
              currentInteraction.singleDateField === "startDate"
                ? nextRange.startDate
                : nextRange.dueDate
            ).getTime()
        )
        : hasSameDateRange(
          nextRange.startDate,
          nextRange.dueDate,
          currentInteraction.originalStartDate,
          currentInteraction.originalDueDate,
        );

      if (hasNoDateChange) {
        removeDateOverride(currentInteraction.cardId);
        setActiveInteraction(null);
        return;
      }

      pendingUpdateCardIdRef.current = currentInteraction.cardId;
      setUpdatingCardId(currentInteraction.cardId);
      setActiveInteraction(null);
      if (currentInteraction.mode === "move-milestone") {
        const nextSingleDate = currentInteraction.singleDateField === "startDate"
          ? nextRange.startDate
          : nextRange.dueDate;

        executeUpdateCard({
          id: currentInteraction.cardId,
          boardId,
          ...(currentInteraction.singleDateField === "startDate"
            ? { startDate: nextSingleDate }
            : { dueDate: nextSingleDate }),
          dueDateTimezoneOffset: getDateTimezoneOffset(nextSingleDate),
        });
        return;
      }

      executeUpdateCard({
        id: currentInteraction.cardId,
        boardId,
        startDate: nextRange.startDate,
        dueDate: nextRange.dueDate,
        dueDateTimezoneOffset: getDateTimezoneOffset(nextRange.dueDate),
      });
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerEnd);
    window.addEventListener("pointercancel", handlePointerEnd);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerEnd);
      window.removeEventListener("pointercancel", handlePointerEnd);
    };
  }, [boardId, executeUpdateCard, interaction, zoom]);

  const derived = useMemo(() => {
    const allCards = timelineLists.flatMap((list) => list.cards);
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
  }, [timelineLists, zoom]);
  const hasCards = derived.stats.totalCards > 0;
  const hasScheduledCards = derived.scheduledCards.length > 0;

  return (
    <>
      <BoardTimelineRealtimeSubscriptions
        channelName={realtimeChannelName}
        enabled={realtimeEnabled}
        onRefresh={handleTimelineRefresh}
        onAccessRevoked={handleTimelineAccessRevoked}
        onBoardDeleted={handleTimelineBoardDeleted}
      />
      <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50 text-neutral-950 shadow-sm">
        <div className="flex shrink-0 flex-col gap-3 border-b border-neutral-200 bg-white px-3 py-2 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-neutral-950">Tiến độ</h1>
            <p className="text-xs text-neutral-500">
              {format(derived.timelineStart, "dd/MM/yyyy", { locale: vi })} - {format(derived.timelineEnd, "dd/MM/yyyy", { locale: vi })}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setIsUnscheduledPanelOpen((value) => !value)}
              className={cn(
                "inline-flex h-9 cursor-pointer items-center gap-x-1.5 rounded-lg border px-3 text-xs font-semibold transition",
                isUnscheduledPanelOpen
                  ? "border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100 hover:text-violet-800"
                  : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50 hover:text-neutral-950",
              )}
            >
              <CalendarX2 className="h-3.5 w-3.5 shrink-0" />
              <span>Chưa lên lịch ({derived.stats.unscheduledCards})</span>
            </button>
            <TimelineToolbar zoom={zoom} onZoomChange={setZoom} />
          </div>
        </div>

        <div className="relative min-h-0 flex-1 overflow-hidden p-3">
          {!hasScheduledCards ? (
            <EmptyTimeline hasCards={hasCards} />
          ) : (
            <div
              ref={ganttScrollContainerRef}
              className="h-full overflow-auto rounded-lg border border-neutral-200 bg-white"
              style={{ maxHeight: GANTT_MAX_HEIGHT }}
            >
              <div className="min-w-max">
                <TimelineGrid
                  rows={derived.scheduledCards}
                  units={derived.units}
                  zoom={zoom}
                  onOpenCard={openCard}
                  onBarPointerDown={handleBarPointerDown}
                  canEdit={canEditTimeline}
                  updatingCardId={updatingCardId}
                  activeInteraction={interaction}
                  scrollContainerRef={ganttScrollContainerRef}
                />
              </div>
            </div>
          )}

          <UnscheduledDrawer
            cards={derived.unscheduledCards}
            isOpen={isUnscheduledPanelOpen}
            onClose={() => setIsUnscheduledPanelOpen(false)}
            onOpenCard={openCard}
          />
        </div>
      </section>
    </>
  );
};
