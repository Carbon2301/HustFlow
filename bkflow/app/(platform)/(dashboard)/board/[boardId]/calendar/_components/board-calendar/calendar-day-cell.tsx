"use client";

import type { DragEvent, MouseEvent } from "react";
import { format, isSameMonth, isToday } from "date-fns";
import { Plus } from "lucide-react";

import { Hint } from "@/components/hint";
import { cn } from "@/lib/utils";

import { CalendarOccurrenceItem } from "./calendar-occurrence";
import {
  MONTH_RANGE_LANES,
  RANGE_LANE_GAP,
  RANGE_LANE_HEIGHT,
  WEEK_DAYS,
  WEEK_RANGE_LANES,
} from "./constants";
import { getDayKey } from "./date-utils";
import type {
  CalendarMarkerListStyle,
  CalendarOccurrence,
  CalendarRangeSegment,
  CalendarResizeState,
  ViewMode,
} from "./types";

type CalendarDayCellProps = {
  day: Date;
  index: number;
  viewMode: ViewMode;
  variant: "default" | "split";
  currentMonth: Date;
  maxVisibleDesktop: number;
  maxVisibleMobile: number;
  listsCount: number;
  isCreatingCard: boolean;
  isUpdatingCardDate: boolean;
  isUpdatingChecklistItemDueDate: boolean;
  draggingOccurrenceId: string | null;
  draggingUnscheduledCardId: string | null;
  draggingBoardCardId: string | null;
  draggingDayViewBlockId: string | null;
  dragOverDayKey: string | null;
  resizingRange: CalendarResizeState | null;
  occurrencesByDay: Record<string, CalendarOccurrence[]>;
  rangeOccurrencesByDay: Record<string, CalendarOccurrence[]>;
  rangeSegmentsByWeek: Record<number, CalendarRangeSegment[]>;
  canClearStartDate: (occurrence: CalendarOccurrence) => boolean;
  canClearDueDate: (occurrence: CalendarOccurrence) => boolean;
  onOpenCard: (
    cardId: string,
    event?: MouseEvent<HTMLElement>,
    options?: { checklistItemId?: string },
  ) => void;
  onOpenCardDirect: (
    cardId: string,
    options?: { checklistItemId?: string },
  ) => void;
  onOccurrenceDragStart: (
    event: DragEvent<HTMLDivElement>,
    occurrence: CalendarOccurrence,
  ) => void;
  onOccurrenceDragEnd: () => void;
  onQuickActionClick: (
    event: MouseEvent<HTMLButtonElement>,
    action: () => void,
  ) => void;
  onToggleComplete: (occurrence: CalendarOccurrence) => void;
  onClearStartDate: (occurrence: CalendarOccurrence) => void;
  onClearDueDate: (occurrence: CalendarOccurrence) => void;
  onOpenCreateDialog: (day: Date, event: MouseEvent<HTMLButtonElement>) => void;
  onSetExpandedDayKey: (dayKey: string) => void;
  onDayDragOver: (event: DragEvent<HTMLDivElement>, dayKey: string) => void;
  onDayDrop: (event: DragEvent<HTMLDivElement>, day: Date) => void;
  onDayDragLeave: (dayKey: string) => void;
};

export const CalendarDayCell = ({
  day,
  index,
  viewMode,
  variant,
  currentMonth,
  maxVisibleDesktop,
  maxVisibleMobile,
  listsCount,
  isCreatingCard,
  isUpdatingCardDate,
  isUpdatingChecklistItemDueDate,
  draggingOccurrenceId,
  draggingUnscheduledCardId,
  draggingBoardCardId,
  draggingDayViewBlockId,
  dragOverDayKey,
  resizingRange,
  occurrencesByDay,
  rangeOccurrencesByDay,
  rangeSegmentsByWeek,
  canClearStartDate,
  canClearDueDate,
  onOpenCard,
  onOpenCardDirect,
  onOccurrenceDragStart,
  onOccurrenceDragEnd,
  onQuickActionClick,
  onToggleComplete,
  onClearStartDate,
  onClearDueDate,
  onOpenCreateDialog,
  onSetExpandedDayKey,
  onDayDragOver,
  onDayDrop,
  onDayDragLeave,
}: CalendarDayCellProps) => {
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
      onDragOver={(event) => onDayDragOver(event, dayKey)}
      onDragEnter={(event) => onDayDragOver(event, dayKey)}
      onDragLeave={() => onDayDragLeave(dayKey)}
      onDrop={(event) => onDayDrop(event, day)}
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
        <Hint description={listsCount === 0 ? "Tạo danh sách trước khi thêm thẻ từ lịch" : `Thêm thẻ vào ngày ${format(day, "dd/MM/yyyy")}`} side="top">
          <button
            type="button"
            onClick={(event) => onOpenCreateDialog(day, event)}
            disabled={
              !!resizingRange ||
              listsCount === 0 ||
              isCreatingCard ||
              isUpdatingCardDate ||
              isUpdatingChecklistItemDueDate
            }
            aria-label={listsCount === 0 ? "Tạo danh sách trước khi thêm thẻ từ lịch" : `Thêm thẻ vào ngày ${format(day, "dd/MM/yyyy")}`}
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
            onOpenCard={onOpenCard}
            onOpenCardDirect={onOpenCardDirect}
            onDragStart={onOccurrenceDragStart}
            onDragEnd={onOccurrenceDragEnd}
            onQuickActionClick={onQuickActionClick}
            onToggleComplete={onToggleComplete}
            onClearStartDate={onClearStartDate}
            onClearDueDate={onClearDueDate}
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
            onOpenCard={onOpenCard}
            onOpenCardDirect={onOpenCardDirect}
            onDragStart={onOccurrenceDragStart}
            onDragEnd={onOccurrenceDragEnd}
            onQuickActionClick={onQuickActionClick}
            onToggleComplete={onToggleComplete}
            onClearStartDate={onClearStartDate}
            onClearDueDate={onClearDueDate}
          />,
        )}
        {mobileOverflow > 0 && (
          <button
            type="button"
            onClick={() => onSetExpandedDayKey(dayKey)}
            aria-label={`Xem thêm ${mobileOverflow} thẻ trong ngày ${format(day, "dd/MM/yyyy")}`}
            className="flex h-6 w-full items-center rounded-md px-1.5 text-left text-[11px] font-semibold text-neutral-500 transition hover:bg-neutral-100 sm:hidden"
          >
            +{mobileOverflow} thẻ
          </button>
        )}
        {desktopOverflow > 0 && (
          <button
            type="button"
            onClick={() => onSetExpandedDayKey(dayKey)}
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
