"use client";

import type { CSSProperties, PointerEvent } from "react";
import { AlertTriangle } from "lucide-react";

import { Hint } from "@/components/hint";
import { cn } from "@/lib/utils";
import type { BoardTimelineCard } from "@/types";

import type {
  ScheduledCard,
  TimelineInteraction,
  TimelineInteractionMode,
  TimelinePlacement,
} from "../_types";
import {
  BAR_HEIGHT,
  BAR_VERTICAL_OFFSET,
  getCardTimelineTitle,
  getCardTone,
} from "../_lib/layout-utils";
import {
  getDependencyPreview,
  getDependencyPreviewLabel,
} from "../_lib/dependency-layout";

export const DependencyPreviewBadge = ({
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

type TimelineBarProps = {
  row: ScheduledCard;
  placement: TimelinePlacement;
  columnWidth: number;
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
  setCardNodeRef: (cardId: string, node: HTMLButtonElement | null) => void;
  isExporting?: boolean;
};

export const TimelineBar = ({
  row,
  placement,
  columnWidth,
  onOpenCard,
  onBarPointerDown,
  canEdit,
  updatingCardId,
  activeInteraction,
  setCardNodeRef,
  isExporting = false,
}: TimelineBarProps) => {
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

  if (row.isMilestone) {
    return (
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
        {isExporting && (
          <span
            className="absolute top-1/2 z-20 ml-2 -translate-y-1/2 whitespace-nowrap rounded bg-white/90 px-1.5 py-0.5 text-xs font-semibold text-neutral-800 shadow-sm"
            style={{ left: placement.left + columnWidth / 2 + 12 }}
          >
            {row.card.title}
          </span>
        )}
        <DependencyPreviewBadge
          card={row.card}
          className="absolute top-1/2 -translate-y-1/2"
          style={{ left: placement.left + columnWidth / 2 + (isExporting ? 24 + row.card.title.length * 7 : 12) }}
        />
      </>
    );
  }

  return (
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
          "absolute z-20 flex cursor-pointer touch-none items-center gap-1.5 rounded-md border px-2 text-left text-xs font-semibold shadow-sm transition hover:shadow-md",
          isExporting ? "overflow-visible" : "overflow-hidden",
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
        <span className={cn(isExporting ? "whitespace-nowrap" : "truncate")}>
          {row.card.title}
        </span>
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
  );
};
