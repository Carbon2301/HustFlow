"use client";

import {
  CalendarDays,
  CalendarX2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import { Hint } from "@/components/hint";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { ViewMode } from "./board-calendar/types";

type CalendarToolbarProps = {
  titleLabel: string;
  rangeLabel: string;
  scheduledItemsCount: number;
  completedItemsCount: number;
  overdueItemsCount: number;
  isUnscheduledCollapsed: boolean;
  filteredUnscheduledCount: number;
  viewMode: ViewMode;
  previousLabel: string;
  nextLabel: string;
  onToggleUnscheduledCollapsed: () => void;
  onChangeViewMode: (mode: ViewMode) => void;
  onPrevious: () => void;
  onToday: () => void;
  onNext: () => void;
};

export const CalendarToolbar = ({
  titleLabel,
  rangeLabel,
  scheduledItemsCount,
  completedItemsCount,
  overdueItemsCount,
  isUnscheduledCollapsed,
  filteredUnscheduledCount,
  viewMode,
  previousLabel,
  nextLabel,
  onToggleUnscheduledCollapsed,
  onChangeViewMode,
  onPrevious,
  onToday,
  onNext,
}: CalendarToolbarProps) => (
  <div className="flex shrink-0 flex-col gap-2 border-b border-neutral-200 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex items-center gap-x-2">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-700">
          <CalendarDays className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold text-neutral-900">
            {titleLabel}
          </h1>
          <p className="truncate text-xs text-neutral-500">
            {rangeLabel}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 text-xs text-neutral-600">
        <div className="inline-flex h-7 items-center gap-x-1.5 rounded-md border border-neutral-200 bg-neutral-50 px-2.5">
          <span className="font-semibold text-neutral-900">{scheduledItemsCount}</span>
          <span className="whitespace-nowrap">thẻ có lịch</span>
        </div>
        <div className="inline-flex h-7 items-center gap-x-1.5 rounded-md border border-emerald-100 bg-emerald-50 px-2.5 text-emerald-700">
          <span className="font-semibold">{completedItemsCount}</span>
          <span className="whitespace-nowrap">hoàn thành</span>
        </div>
        <div className="inline-flex h-7 items-center gap-x-1.5 rounded-md border border-rose-100 bg-rose-50 px-2.5 text-rose-700">
          <span className="font-semibold">{overdueItemsCount}</span>
          <span className="whitespace-nowrap">quá hạn</span>
        </div>
      </div>
    </div>

    <div className="flex flex-wrap items-center gap-2 lg:justify-end">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onToggleUnscheduledCollapsed}
          className={cn(
            "h-8 gap-x-1.5 px-3 text-xs font-semibold shadow-sm border",
            isUnscheduledCollapsed
              ? "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
              : "border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100 hover:text-violet-800",
          )}
        >
          <CalendarX2 className="h-3.5 w-3.5 shrink-0" />
          <span>Chưa lên lịch ({filteredUnscheduledCount})</span>
        </Button>

        <div className="flex h-8 shrink-0 items-center rounded-lg border border-neutral-200 bg-white p-0.5 shadow-sm">
          {(["month", "week", "day"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => onChangeViewMode(mode)}
              className={cn(
                "h-7 rounded-md px-3 text-xs font-semibold text-neutral-600 transition hover:bg-neutral-100",
                viewMode === mode && "bg-violet-600 text-white shadow-sm hover:bg-violet-600",
              )}
            >
              {mode === "month" ? "Tháng" : mode === "week" ? "Tuần" : "Ngày"}
            </button>
          ))}
        </div>

        <div className="flex h-8 shrink-0 items-center rounded-lg border border-neutral-200 bg-white p-0.5 shadow-sm">
          <Hint description={previousLabel} side="top">
            <button
              type="button"
              onClick={onPrevious}
              className="flex h-7 w-7 items-center justify-center rounded-md text-neutral-600 transition hover:bg-neutral-100"
              aria-label={previousLabel}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </Hint>
          <Hint description="Về hôm nay" side="top">
            <button
              type="button"
              onClick={onToday}
              className="h-7 rounded-md px-2 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100"
            >
              Hôm nay
            </button>
          </Hint>
          <Hint description={nextLabel} side="top">
            <button
              type="button"
              onClick={onNext}
              className="flex h-7 w-7 items-center justify-center rounded-md text-neutral-600 transition hover:bg-neutral-100"
              aria-label={nextLabel}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </Hint>
        </div>
      </div>
    </div>
  </div>
);
