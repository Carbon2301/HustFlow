"use client";

import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";

import {
  RANGE_LANE_GAP,
  RANGE_LANE_HEIGHT,
} from "../../_lib/constants";
import { getDayKey } from "../../_lib/date-utils";
import type {
  CalendarRangeSegment,
  ViewMode,
} from "../../_types";

type CalendarRangeOverflowsProps = {
  weekDays: Date[];
  segments: CalendarRangeSegment[];
  maxLanes: number;
  mode: ViewMode;
  onSetExpandedDayKey: (dayKey: string) => void;
};

export const CalendarRangeOverflows = ({
  weekDays,
  segments,
  maxLanes,
  mode,
  onSetExpandedDayKey,
}: CalendarRangeOverflowsProps) => {
  return weekDays.map((day, dayIndex) => {
    const dayKey = getDayKey(day);
    const rangeOverflowCount = segments.filter(
      (segment) =>
        segment.lane >= maxLanes &&
        segment.startIndex <= dayIndex &&
        segment.endIndex >= dayIndex
    ).length;

    if (rangeOverflowCount === 0) {
      return null;
    }

    const leftPercent = (dayIndex / 7) * 100;
    const widthPercent = (1 / 7) * 100;
    const style: CSSProperties = {
      left: `${leftPercent}%`,
      width: `${widthPercent}%`,
      top: 36 + maxLanes * (RANGE_LANE_HEIGHT + RANGE_LANE_GAP),
    };

    return (
      <button
        key={`range-overflow-${dayKey}`}
        type="button"
        style={style}
        onClick={() => onSetExpandedDayKey(dayKey)}
        className={cn(
          "absolute z-10 h-7 px-0.5 focus:outline-none",
          mode === "week" && "hidden md:block"
        )}
      >
        <div className="flex h-full w-full items-center justify-center rounded-md bg-neutral-100 px-1.5 text-[11px] font-semibold text-neutral-500 hover:bg-neutral-200 transition">
          +{rangeOverflowCount} dải
        </div>
      </button>
    );
  });
};
