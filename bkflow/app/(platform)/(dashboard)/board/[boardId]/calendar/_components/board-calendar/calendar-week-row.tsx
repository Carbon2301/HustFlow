"use client";

import type { DragEvent, MouseEvent, PointerEvent } from "react";

import { cn } from "@/lib/utils";

import { CalendarDayCell } from "./calendar-day-cell";
import { CalendarRangeOverflows } from "./calendar-range-overflows";
import { CalendarRangeSegmentItem } from "./calendar-range-segment";
import {
  MONTH_RANGE_LANES,
  WEEK_RANGE_LANES,
} from "../../_lib/constants";
import type {
  CalendarOccurrence,
  CalendarRange,
  CalendarRangeSegment,
  CalendarResizeEdge,
  CalendarResizeState,
  ViewMode,
} from "../../_types";

type CalendarWeekRowProps = {
  weekDays: Date[];
  weekIndex: number;
  mode: ViewMode;
  weekRowsLength: number;
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
  onRangeResizeStart: (
    event: PointerEvent<HTMLButtonElement>,
    range: CalendarRange,
    edge: CalendarResizeEdge,
  ) => void;
  onRangeResizeMove: (event: PointerEvent<HTMLButtonElement>) => void;
  onRangeResizeEnd: (event: PointerEvent<HTMLButtonElement>) => void;
  onRangeResizeCancel: () => void;
};

export const CalendarWeekRow = ({
  weekDays,
  weekIndex,
  mode,
  weekRowsLength,
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
  onRangeResizeStart,
  onRangeResizeMove,
  onRangeResizeEnd,
  onRangeResizeCancel,
}: CalendarWeekRowProps) => {
  const segments = rangeSegmentsByWeek[weekIndex] ?? [];
  const maxLanes = mode === "month" ? MONTH_RANGE_LANES : WEEK_RANGE_LANES;

  return (
    <div
      key={`week-row:${weekIndex}`}
      className={cn(
        "relative grid grid-cols-7 bg-white",
        mode === "month" && weekIndex === weekRowsLength - 1 && "rounded-b-lg",
        mode === "week" && "grid-cols-1 gap-2 bg-transparent md:grid-cols-7",
      )}
    >
      {weekDays.map((day, dayIndex) => (
        <CalendarDayCell
          key={day.toISOString()}
          day={day}
          index={weekIndex * 7 + dayIndex}
          viewMode={viewMode}
          variant={variant}
          currentMonth={currentMonth}
          maxVisibleDesktop={maxVisibleDesktop}
          maxVisibleMobile={maxVisibleMobile}
          listsCount={listsCount}
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
          onOpenCard={onOpenCard}
          onOpenCardDirect={onOpenCardDirect}
          onOccurrenceDragStart={onOccurrenceDragStart}
          onOccurrenceDragEnd={onOccurrenceDragEnd}
          onQuickActionClick={onQuickActionClick}
          onToggleComplete={onToggleComplete}
          onClearStartDate={onClearStartDate}
          onClearDueDate={onClearDueDate}
          onOpenCreateDialog={onOpenCreateDialog}
          onSetExpandedDayKey={onSetExpandedDayKey}
          onDayDragOver={onDayDragOver}
          onDayDrop={onDayDrop}
          onDayDragLeave={onDayDragLeave}
        />
      ))}
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
          onOpenCard={onOpenCard}
          onOpenCardDirect={onOpenCardDirect}
          onRangeResizeStart={onRangeResizeStart}
          onRangeResizeMove={onRangeResizeMove}
          onRangeResizeEnd={onRangeResizeEnd}
          onRangeResizeCancel={onRangeResizeCancel}
          onQuickActionClick={onQuickActionClick}
          onToggleComplete={onToggleComplete}
          onClearStartDate={onClearStartDate}
          onClearDueDate={onClearDueDate}
        />
      ))}
      <CalendarRangeOverflows
        weekDays={weekDays}
        segments={segments}
        maxLanes={maxLanes}
        mode={mode}
        onSetExpandedDayKey={onSetExpandedDayKey}
      />
    </div>
  );
};
