"use client";

import type { PointerEvent } from "react";
import { isToday } from "date-fns";

import { cn } from "@/lib/utils";

import type {
  ScheduledCard,
  TimelineInteraction,
  TimelineInteractionMode,
  TimelineUnit,
} from "../_types";
import {
  ROW_HEIGHT,
  getTimelinePlacement,
} from "../_lib/layout-utils";
import { TimelineBar } from "./timeline-bar";

type TimelineRowProps = {
  row: ScheduledCard;
  units: TimelineUnit[];
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
};

export const TimelineRow = ({
  row,
  units,
  columnWidth,
  onOpenCard,
  onBarPointerDown,
  canEdit,
  updatingCardId,
  activeInteraction,
  setCardNodeRef,
}: TimelineRowProps) => {
  const placement = getTimelinePlacement(row, units, columnWidth);

  return (
    <div
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
      <TimelineBar
        row={row}
        placement={placement}
        columnWidth={columnWidth}
        onOpenCard={onOpenCard}
        onBarPointerDown={onBarPointerDown}
        canEdit={canEdit}
        updatingCardId={updatingCardId}
        activeInteraction={activeInteraction}
        setCardNodeRef={setCardNodeRef}
      />
    </div>
  );
};
