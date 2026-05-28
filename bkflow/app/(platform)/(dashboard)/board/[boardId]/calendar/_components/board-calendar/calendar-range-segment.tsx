"use client";

import type { CSSProperties, MouseEvent, PointerEvent } from "react";
import { CheckCircle2 } from "lucide-react";

import { Hint } from "@/components/hint";
import { cn } from "@/lib/utils";

import {
  RANGE_LANE_GAP,
  RANGE_LANE_HEIGHT,
} from "../../_lib/constants";
import {
  formatCalendarTime,
  parseCalendarDate,
} from "../../_lib/date-utils";
import {
  getCalendarItemTitle,
  getOccurrenceTone,
} from "../../_lib/item-utils";
import { QuickActionsMenu } from "./quick-actions-menu";
import type {
  CalendarOccurrence,
  CalendarRange,
  CalendarRangeSegment,
  CalendarResizeEdge,
  CalendarResizeState,
  ViewMode,
} from "../../_types";

type CalendarRangeSegmentItemProps = {
  segment: CalendarRangeSegment;
  maxLanes: number;
  mode: ViewMode;
  variant: "default" | "split";
  resizingRange: CalendarResizeState | null;
  draggingOccurrenceId: string | null;
  draggingUnscheduledCardId: string | null;
  draggingBoardCardId: string | null;
  draggingDayViewBlockId: string | null;
  isUpdatingCardDate: boolean;
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
  onRangeResizeStart: (
    event: PointerEvent<HTMLButtonElement>,
    range: CalendarRange,
    edge: CalendarResizeEdge,
  ) => void;
  onRangeResizeMove: (event: PointerEvent<HTMLButtonElement>) => void;
  onRangeResizeEnd: (event: PointerEvent<HTMLButtonElement>) => void;
  onRangeResizeCancel: () => void;
  onQuickActionClick: (
    event: MouseEvent<HTMLButtonElement>,
    action: () => void,
  ) => void;
  onToggleComplete: (occurrence: CalendarOccurrence) => void;
  onClearStartDate: (occurrence: CalendarOccurrence) => void;
  onClearDueDate: (occurrence: CalendarOccurrence) => void;
};

export const CalendarRangeSegmentItem = ({
  segment,
  maxLanes,
  mode,
  variant,
  resizingRange,
  draggingOccurrenceId,
  draggingUnscheduledCardId,
  draggingBoardCardId,
  draggingDayViewBlockId,
  isUpdatingCardDate,
  canClearStartDate,
  canClearDueDate,
  onOpenCard,
  onOpenCardDirect,
  onRangeResizeStart,
  onRangeResizeMove,
  onRangeResizeEnd,
  onRangeResizeCancel,
  onQuickActionClick,
  onToggleComplete,
  onClearStartDate,
  onClearDueDate,
}: CalendarRangeSegmentItemProps) => {
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
                onPointerDown={(event) => onRangeResizeStart(event, segment.range, "start")}
                onPointerMove={onRangeResizeMove}
                onPointerUp={onRangeResizeEnd}
                onPointerCancel={onRangeResizeCancel}
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
            onClick={(event) => onOpenCard(segment.range.item.cardId, event)}
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
          {variant !== "split" && (
            <QuickActionsMenu
              occurrence={occurrence}
              isUpdatingCardDate={isUpdatingCardDate}
              canClearStartDate={canClearStartDate}
              canClearDueDate={canClearDueDate}
              onQuickActionClick={onQuickActionClick}
              onOpenCardDirect={onOpenCardDirect}
              onToggleComplete={onToggleComplete}
              onClearStartDate={onClearStartDate}
              onClearDueDate={onClearDueDate}
            />
          )}
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
                onPointerDown={(event) => onRangeResizeStart(event, segment.range, "end")}
                onPointerMove={onRangeResizeMove}
                onPointerUp={onRangeResizeEnd}
                onPointerCancel={onRangeResizeCancel}
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
