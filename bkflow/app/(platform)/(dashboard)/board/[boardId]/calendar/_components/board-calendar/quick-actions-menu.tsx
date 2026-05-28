"use client";

import type { MouseEvent } from "react";
import {
  CalendarX2,
  CheckCircle2,
  Circle,
  ExternalLink,
  MoreHorizontal,
} from "lucide-react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { BoardCalendarItem } from "@/types";

import { isCalendarCardItem } from "../../_lib/item-utils";
import type { CalendarOccurrence } from "../../_types";

type QuickActionsMenuProps = {
  occurrence: CalendarOccurrence;
  isUpdatingCardDate: boolean;
  canClearStartDate: (occurrence: CalendarOccurrence) => boolean;
  canClearDueDate: (occurrence: CalendarOccurrence) => boolean;
  onQuickActionClick: (
    event: MouseEvent<HTMLButtonElement>,
    action: () => void,
  ) => void;
  onOpenCardDirect: (
    cardId: string,
    options?: { checklistItemId?: string },
  ) => void;
  onToggleComplete: (occurrence: CalendarOccurrence) => void;
  onClearStartDate: (occurrence: CalendarOccurrence) => void;
  onClearDueDate: (occurrence: CalendarOccurrence) => void;
};

export const QuickActionsMenu = ({
  occurrence,
  isUpdatingCardDate,
  canClearStartDate,
  canClearDueDate,
  onQuickActionClick,
  onOpenCardDirect,
  onToggleComplete,
  onClearStartDate,
  onClearDueDate,
}: QuickActionsMenuProps) => {
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
            onClick={(event) => onQuickActionClick(event, () => onOpenCardDirect(checklistItem.cardId, {
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
          onClick={(event) => onQuickActionClick(event, () => onOpenCardDirect(occurrence.item.cardId))}
          className="flex h-8 w-full items-center gap-x-2 rounded-md px-2 text-left text-xs font-medium text-neutral-700 transition hover:bg-neutral-100 disabled:cursor-wait disabled:opacity-50"
        >
          <ExternalLink className="h-3.5 w-3.5 text-neutral-500" />
          Mở thẻ
        </button>
        <button
          type="button"
          disabled={isUpdatingCardDate}
          onClick={(event) => onQuickActionClick(event, () => onToggleComplete(occurrence))}
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
            onClick={(event) => onQuickActionClick(event, () => onClearStartDate(occurrence))}
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
            onClick={(event) => onQuickActionClick(event, () => onClearDueDate(occurrence))}
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
