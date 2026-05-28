"use client";

import type { MouseEvent } from "react";
import {
  CheckCircle2,
  Clock,
  MessageSquare,
  UsersRound,
} from "lucide-react";

import { Hint } from "@/components/hint";
import { cn } from "@/lib/utils";

import {
  getCalendarItemAssigneeCount,
  getCalendarItemCommentCount,
  getCalendarItemTitle,
  getOccurrenceLabel,
  getOccurrenceTimeLabel,
  getOccurrenceTone,
} from "../../_lib/item-utils";
import { QuickActionsMenu } from "./quick-actions-menu";
import type { CalendarOccurrence } from "../../_types";

type ExpandedOccurrenceProps = {
  occurrence: CalendarOccurrence;
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
  onQuickActionClick: (
    event: MouseEvent<HTMLButtonElement>,
    action: () => void,
  ) => void;
  onToggleComplete: (occurrence: CalendarOccurrence) => void;
  onClearStartDate: (occurrence: CalendarOccurrence) => void;
  onClearDueDate: (occurrence: CalendarOccurrence) => void;
};

export const ExpandedOccurrence = ({
  occurrence,
  isUpdatingCardDate,
  canClearStartDate,
  canClearDueDate,
  onOpenCard,
  onOpenCardDirect,
  onQuickActionClick,
  onToggleComplete,
  onClearStartDate,
  onClearDueDate,
}: ExpandedOccurrenceProps) => (
  <Hint key={`expanded:${occurrence.id}`} description={getCalendarItemTitle(occurrence.item)} side="top" sideOffset={4} className="max-w-[280px]">
    <div
      className="group/event flex min-w-0 items-start gap-x-2 rounded-lg border border-neutral-200 bg-neutral-50 p-2 text-left transition hover:border-violet-200 hover:bg-violet-50"
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
            {getOccurrenceLabel(occurrence) && (
              <span>{getOccurrenceLabel(occurrence)}</span>
            )}
            {getOccurrenceTimeLabel(occurrence) && (
              <span>{getOccurrenceTimeLabel(occurrence)}</span>
            )}
            <span className="truncate">{occurrence.item.listTitle}</span>
            {getCalendarItemAssigneeCount(occurrence.item) > 0 && (
              <span className="inline-flex items-center gap-x-1">
                <UsersRound className="h-3.5 w-3.5" />
                {getCalendarItemAssigneeCount(occurrence.item)}
              </span>
            )}
            {getCalendarItemCommentCount(occurrence.item) > 0 && (
              <span className="inline-flex items-center gap-x-1">
                <MessageSquare className="h-3.5 w-3.5" />
                {getCalendarItemCommentCount(occurrence.item)}
              </span>
            )}
          </div>
        </div>
      </button>
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
    </div>
  </Hint>
);
