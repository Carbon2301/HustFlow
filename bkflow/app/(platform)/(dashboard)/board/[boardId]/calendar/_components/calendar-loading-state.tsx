"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import type { ViewMode } from "../_types";

type CalendarLoadingStateProps = {
  viewMode: Exclude<ViewMode, "day">;
  days: Date[];
};

export const CalendarLoadingState = ({
  viewMode,
  days,
}: CalendarLoadingStateProps) => (
  <div
    className={cn(
      viewMode === "month" && "grid grid-cols-7 rounded-b-lg border border-neutral-200",
      viewMode === "week" && "grid grid-cols-1 gap-2 md:grid-cols-7",
    )}
  >
    {days.map((day, index) => (
      <div
        key={day.toISOString()}
        className={cn(
          "border-neutral-200 p-1.5 md:p-2",
          viewMode === "month" && "min-h-[104px] border-r border-b last:border-r-0 sm:min-h-[132px]",
          viewMode === "week" && "min-h-[132px] rounded-lg border md:min-h-[360px]",
          viewMode === "week" && index > 0 && "mt-2 md:mt-0",
        )}
      >
        <Skeleton className="mb-3 h-4 w-12 rounded bg-neutral-100" />
        <Skeleton className="mb-1.5 h-7 rounded-md bg-neutral-100" />
        <Skeleton className="h-7 rounded-md bg-neutral-100" />
      </div>
    ))}
  </div>
);
