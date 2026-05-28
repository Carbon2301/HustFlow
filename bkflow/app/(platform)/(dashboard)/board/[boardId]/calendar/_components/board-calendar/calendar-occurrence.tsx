"use client";

import type { DragEvent, MouseEvent } from "react";
import { CheckCircle2, ListChecks } from "lucide-react";

import { Hint } from "@/components/hint";
import { cn } from "@/lib/utils";

import {
  getCalendarItemTitle,
  getOccurrenceLabel,
  getOccurrenceTimeLabel,
  getOccurrenceTone,
  isCalendarCardItem,
  isCalendarChecklistItem,
} from "../../_lib/item-utils";
import { QuickActionsMenu } from "./quick-actions-menu";
import type { CalendarOccurrence } from "../../_types";

type CalendarOccurrenceItemProps = {
  occurrence: CalendarOccurrence;
  variant: "default" | "split";
  className?: string;
  draggingOccurrenceId: string | null;
  isUpdatingCardDate: boolean;
  isUpdatingChecklistItemDueDate: boolean;
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
  onDragStart: (
    event: DragEvent<HTMLDivElement>,
    occurrence: CalendarOccurrence,
  ) => void;
  onDragEnd: () => void;
  onQuickActionClick: (
    event: MouseEvent<HTMLButtonElement>,
    action: () => void,
  ) => void;
  onToggleComplete: (occurrence: CalendarOccurrence) => void;
  onClearStartDate: (occurrence: CalendarOccurrence) => void;
  onClearDueDate: (occurrence: CalendarOccurrence) => void;
};

export const CalendarOccurrenceItem = ({
  occurrence,
  variant,
  className,
  draggingOccurrenceId,
  isUpdatingCardDate,
  isUpdatingChecklistItemDueDate,
  canClearStartDate,
  canClearDueDate,
  onOpenCard,
  onOpenCardDirect,
  onDragStart,
  onDragEnd,
  onQuickActionClick,
  onToggleComplete,
  onClearStartDate,
  onClearDueDate,
}: CalendarOccurrenceItemProps) => {
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
        onDragStart={(event) => onDragStart(event, occurrence)}
        onDragEnd={onDragEnd}
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
          onClick={(event) => onOpenCard(
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
      </div>
    </Hint>
  );
};
