"use client";

import type {
  DragEvent,
  MouseEvent,
  PointerEvent,
} from "react";
import {
  CheckCircle2,
  Clock,
  ListChecks,
} from "lucide-react";

import { Hint } from "@/components/hint";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { DAY_VIEW_SLOT_HEIGHT } from "@/lib/calendar/calendar-day-view";
import { cn } from "@/lib/utils";

import {
  DAY_TIME_SLOTS,
  MINUTES_IN_DAY,
} from "../../_lib/constants";
import {
  formatDayTitle,
  getGmt7DayKey,
  getGmt7Parts,
} from "../../_lib/date-utils";
import {
  getDayViewBlockContext,
  getDayViewBlockStyle,
  getDayViewBlockTimeLabel,
  getDayViewBlockTone,
  getDayViewBlockTooltip,
} from "../../_lib/day-view-layout";
import { isOverdue } from "../../_lib/item-utils";
import type {
  CalendarResizeEdge,
  DayViewBlock,
  DayViewBlockLayout,
  DayViewOverflowGroup,
  DayViewResizeState,
  PositionedDayViewBlock,
} from "../../_types";

type DayViewCreatePreview = {
  startMinute: number;
  endMinute: number;
};

type DayViewTimeGridProps = {
  anchorDate: Date;
  currentTime: Date;
  isSkeleton?: boolean;
  dayViewBlocks: DayViewBlock[];
  desktopDayViewLayout: DayViewBlockLayout;
  mobileDayViewLayout: DayViewBlockLayout;
  dayViewCreatePreview: DayViewCreatePreview | null;
  openDayOverflowGroupId: string | null;
  resizingDayViewBlock: DayViewResizeState | null;
  dragOverDaySlotIndex: number | null;
  dragOverDayMinute: number | null;
  draggingDayViewBlockId: string | null;
  isUpdatingCardDate: boolean;
  isUpdatingChecklistItemDueDate: boolean;
  onOpenDayOverflowGroupChange: (groupId: string | null) => void;
  onOpenCard: (
    cardId: string,
    event?: MouseEvent<HTMLElement>,
    options?: { checklistItemId?: string },
  ) => void;
  onDayViewBlockDragStart: (
    event: DragEvent<HTMLElement>,
    block: PositionedDayViewBlock,
  ) => void;
  onDayViewBlockDragEnd: () => void;
  onDayViewBlockResizeStart: (
    event: PointerEvent<HTMLSpanElement>,
    block: PositionedDayViewBlock,
    edge: CalendarResizeEdge,
  ) => void;
  onDayViewBlockResizeMove: (event: PointerEvent<HTMLSpanElement>) => void;
  onDayViewBlockResizeEnd: (event: PointerEvent<HTMLSpanElement>) => void;
  onDayViewBlockResizeCancel: () => void;
  onDayViewCreatePointerDown: (event: PointerEvent<HTMLDivElement>) => void;
  onDayViewCreatePointerMove: (event: PointerEvent<HTMLDivElement>) => void;
  onDayViewCreatePointerEnd: (event: PointerEvent<HTMLDivElement>) => void;
  onDayViewCreatePointerCancel: () => void;
  onDayViewDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onDayViewDragLeave: (event: DragEvent<HTMLDivElement>) => void;
  onDayViewDrop: (event: DragEvent<HTMLDivElement>) => void;
};

type DayViewTimelineBlockProps = {
  block: PositionedDayViewBlock;
  className: string;
  resizingDayViewBlock: DayViewResizeState | null;
  draggingDayViewBlockId: string | null;
  isUpdatingCardDate: boolean;
  isUpdatingChecklistItemDueDate: boolean;
  onOpenCard: DayViewTimeGridProps["onOpenCard"];
  onDragStart: DayViewTimeGridProps["onDayViewBlockDragStart"];
  onDragEnd: DayViewTimeGridProps["onDayViewBlockDragEnd"];
  onResizeStart: DayViewTimeGridProps["onDayViewBlockResizeStart"];
  onResizeMove: DayViewTimeGridProps["onDayViewBlockResizeMove"];
  onResizeEnd: DayViewTimeGridProps["onDayViewBlockResizeEnd"];
  onResizeCancel: DayViewTimeGridProps["onDayViewBlockResizeCancel"];
};

const DayViewTimelineBlock = ({
  block,
  className,
  resizingDayViewBlock,
  draggingDayViewBlockId,
  isUpdatingCardDate,
  isUpdatingChecklistItemDueDate,
  onOpenCard,
  onDragStart,
  onDragEnd,
  onResizeStart,
  onResizeMove,
  onResizeEnd,
  onResizeCancel,
}: DayViewTimelineBlockProps) => {
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
        onClick={(event) => onOpenCard(
          block.item.cardId,
          event,
          checklistItemId ? { checklistItemId } : undefined,
        )}
        draggable={canDragDayViewBlock}
        onDragStart={(event) => onDragStart(event, block)}
        onDragEnd={onDragEnd}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") {
            return;
          }

          event.preventDefault();
          onOpenCard(
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
              onPointerDown={(event) => onResizeStart(event, block, "start")}
              onPointerMove={onResizeMove}
              onPointerUp={onResizeEnd}
              onPointerCancel={onResizeCancel}
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
              onPointerDown={(event) => onResizeStart(event, block, "end")}
              onPointerMove={onResizeMove}
              onPointerUp={onResizeEnd}
              onPointerCancel={onResizeCancel}
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

type DayOverflowItemProps = {
  block: PositionedDayViewBlock;
  onOpenCard: DayViewTimeGridProps["onOpenCard"];
  onOpenDayOverflowGroupChange: DayViewTimeGridProps["onOpenDayOverflowGroupChange"];
};

const DayOverflowItem = ({
  block,
  onOpenCard,
  onOpenDayOverflowGroupChange,
}: DayOverflowItemProps) => {
  const isChecklistItem = block.item.type === "checklist-item";
  const checklistItemId = block.item.type === "checklist-item"
    ? block.item.checklistItemId
    : undefined;

  return (
    <button
      type="button"
      onClick={(event) => {
        onOpenDayOverflowGroupChange(null);
        onOpenCard(
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

type DayOverflowGroupProps = {
  group: DayViewOverflowGroup;
  className: string;
  instanceId: string;
  openDayOverflowGroupId: string | null;
  onOpenDayOverflowGroupChange: DayViewTimeGridProps["onOpenDayOverflowGroupChange"];
  onOpenCard: DayViewTimeGridProps["onOpenCard"];
};

const DayOverflowGroup = ({
  group,
  className,
  instanceId,
  openDayOverflowGroupId,
  onOpenDayOverflowGroupChange,
  onOpenCard,
}: DayOverflowGroupProps) => (
  <Popover
    open={openDayOverflowGroupId === instanceId}
    onOpenChange={(open) =>
      onOpenDayOverflowGroupChange(open ? instanceId : null)
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
        {group.hiddenBlocks.map((block) => (
          <DayOverflowItem
            key={block.id}
            block={block}
            onOpenCard={onOpenCard}
            onOpenDayOverflowGroupChange={onOpenDayOverflowGroupChange}
          />
        ))}
      </div>
    </PopoverContent>
  </Popover>
);

export const DayViewTimeGrid = ({
  anchorDate,
  currentTime,
  isSkeleton = false,
  dayViewBlocks,
  desktopDayViewLayout,
  mobileDayViewLayout,
  dayViewCreatePreview,
  openDayOverflowGroupId,
  resizingDayViewBlock,
  dragOverDaySlotIndex,
  dragOverDayMinute,
  draggingDayViewBlockId,
  isUpdatingCardDate,
  isUpdatingChecklistItemDueDate,
  onOpenDayOverflowGroupChange,
  onOpenCard,
  onDayViewBlockDragStart,
  onDayViewBlockDragEnd,
  onDayViewBlockResizeStart,
  onDayViewBlockResizeMove,
  onDayViewBlockResizeEnd,
  onDayViewBlockResizeCancel,
  onDayViewCreatePointerDown,
  onDayViewCreatePointerMove,
  onDayViewCreatePointerEnd,
  onDayViewCreatePointerCancel,
  onDayViewDragOver,
  onDayViewDragLeave,
  onDayViewDrop,
}: DayViewTimeGridProps) => {
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
          onPointerDown={isSkeleton ? undefined : onDayViewCreatePointerDown}
          onPointerMove={isSkeleton ? undefined : onDayViewCreatePointerMove}
          onPointerUp={isSkeleton ? undefined : onDayViewCreatePointerEnd}
          onPointerCancel={isSkeleton ? undefined : onDayViewCreatePointerCancel}
          onDragOver={isSkeleton ? undefined : onDayViewDragOver}
          onDragEnter={isSkeleton ? undefined : onDayViewDragOver}
          onDragLeave={isSkeleton ? undefined : onDayViewDragLeave}
          onDrop={isSkeleton ? undefined : onDayViewDrop}
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
              {desktopDayViewLayout.visibleBlocks.map((block) => (
                <DayViewTimelineBlock
                  key={`${block.id}:desktop`}
                  block={block}
                  className="hidden md:flex md:left-[var(--day-block-left)] md:w-[var(--day-block-width)]"
                  resizingDayViewBlock={resizingDayViewBlock}
                  draggingDayViewBlockId={draggingDayViewBlockId}
                  isUpdatingCardDate={isUpdatingCardDate}
                  isUpdatingChecklistItemDueDate={isUpdatingChecklistItemDueDate}
                  onOpenCard={onOpenCard}
                  onDragStart={onDayViewBlockDragStart}
                  onDragEnd={onDayViewBlockDragEnd}
                  onResizeStart={onDayViewBlockResizeStart}
                  onResizeMove={onDayViewBlockResizeMove}
                  onResizeEnd={onDayViewBlockResizeEnd}
                  onResizeCancel={onDayViewBlockResizeCancel}
                />
              ))}
              {desktopDayViewLayout.overflowGroups.map((group) => (
                <DayOverflowGroup
                  key={`${group.id}:desktop`}
                  group={group}
                  className="hidden md:block"
                  instanceId={`${group.id}:desktop`}
                  openDayOverflowGroupId={openDayOverflowGroupId}
                  onOpenDayOverflowGroupChange={onOpenDayOverflowGroupChange}
                  onOpenCard={onOpenCard}
                />
              ))}
              {mobileDayViewLayout.visibleBlocks.map((block) => (
                <DayViewTimelineBlock
                  key={`${block.id}:mobile`}
                  block={block}
                  className="flex md:hidden left-[var(--day-block-left)] w-[var(--day-block-width)]"
                  resizingDayViewBlock={resizingDayViewBlock}
                  draggingDayViewBlockId={draggingDayViewBlockId}
                  isUpdatingCardDate={isUpdatingCardDate}
                  isUpdatingChecklistItemDueDate={isUpdatingChecklistItemDueDate}
                  onOpenCard={onOpenCard}
                  onDragStart={onDayViewBlockDragStart}
                  onDragEnd={onDayViewBlockDragEnd}
                  onResizeStart={onDayViewBlockResizeStart}
                  onResizeMove={onDayViewBlockResizeMove}
                  onResizeEnd={onDayViewBlockResizeEnd}
                  onResizeCancel={onDayViewBlockResizeCancel}
                />
              ))}
              {mobileDayViewLayout.overflowGroups.map((group) => (
                <DayOverflowGroup
                  key={`${group.id}:mobile`}
                  group={group}
                  className="block md:hidden"
                  instanceId={`${group.id}:mobile`}
                  openDayOverflowGroupId={openDayOverflowGroupId}
                  onOpenDayOverflowGroupChange={onOpenDayOverflowGroupChange}
                  onOpenCard={onOpenCard}
                />
              ))}
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
