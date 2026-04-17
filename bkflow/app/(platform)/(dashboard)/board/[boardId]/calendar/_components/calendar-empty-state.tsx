"use client";

import { CalendarDays } from "lucide-react";

import type { ViewMode } from "./board-calendar/types";

type CalendarEmptyStateProps = {
  viewMode: ViewMode;
  filtersAreActive: boolean;
};

export const CalendarEmptyState = ({
  viewMode,
  filtersAreActive,
}: CalendarEmptyStateProps) => {
  if (viewMode === "day") {
    return (
      <div className="mt-3 rounded-lg border border-dashed border-neutral-300 bg-neutral-50 px-4 py-3 text-center">
        <p className="text-sm font-semibold text-neutral-700">
          {filtersAreActive
            ? "Không có mục nào phù hợp với bộ lọc."
            : "Chưa có thẻ nào trong ngày này."}
        </p>
      </div>
    );
  }

  return (
    <div className="mt-3 flex min-h-[96px] flex-col items-center justify-center rounded-lg border border-dashed border-neutral-300 bg-neutral-50 px-4 text-center">
      <CalendarDays className="mb-2 h-6 w-6 text-neutral-400" />
      <p className="text-sm font-semibold text-neutral-700">
        {filtersAreActive
          ? "Không có mục nào phù hợp với bộ lọc."
          : "Chưa có thẻ nào trong khoảng thời gian này."}
      </p>
      {!filtersAreActive && (
        <p className="mt-1 max-w-md text-xs text-neutral-500">
          Các thẻ có ngày bắt đầu hoặc ngày hết hạn sẽ xuất hiện trong lịch.
        </p>
      )}
    </div>
  );
};
