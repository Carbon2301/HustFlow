"use client";

import { ChevronDown } from "lucide-react";

import type { CardWithList } from "@/types";
import { Hint } from "@/components/hint";
import { cn } from "@/lib/utils";

import { CardDatePopover } from "./card-date-popover";

interface CardDateStatusColumnProps {
  data: CardWithList;
  hasDateRange: boolean;
  hasStartDate: boolean;
  hasDueDate: boolean;
  dateSummary: string;
  status: string;
  isLoadingUpdate: boolean;
  onToggleComplete: (event: React.ChangeEvent<HTMLInputElement>) => void;
  isDateOpen: boolean;
  onDateOpenChange: (open: boolean) => void;
  startDateValue: string;
  dueDateValue: string;
  reminderValue: string;
  canSetReminder: boolean;
  onStartDateValueChange: (value: string) => void;
  onDueDateValueChange: (value: string) => void;
  onReminderValueChange: (value: string) => void;
  onDateSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onClearStartDate: () => void;
  onClearDueDate: () => void;
}

export const CardDateStatusColumn = ({
  data,
  hasDateRange,
  hasStartDate,
  hasDueDate,
  dateSummary,
  status,
  isLoadingUpdate,
  onToggleComplete,
  isDateOpen,
  onDateOpenChange,
  startDateValue,
  dueDateValue,
  reminderValue,
  canSetReminder,
  onStartDateValueChange,
  onDueDateValueChange,
  onReminderValueChange,
  onDateSubmit,
  onClearStartDate,
  onClearDueDate,
}: CardDateStatusColumnProps) => {
  return (
    <div className="flex flex-col gap-y-1.5">
      <span className="text-xs font-semibold text-neutral-600 pl-0.5">
        {hasDateRange ? "Ngày" : "Hoàn thành"}
      </span>
      <div className="flex items-center gap-x-2">
        <Hint description={data.isCompleted ? "Đánh dấu chưa hoàn thành" : "Đánh dấu hoàn thành"} side="bottom">
          <input
            type="checkbox"
            checked={data.isCompleted}
            onChange={onToggleComplete}
            disabled={isLoadingUpdate}
            className="h-4.5 w-4.5 rounded-sm border-neutral-300 accent-violet-600 cursor-pointer shadow-xs"
            aria-label={data.isCompleted ? "Đánh dấu chưa hoàn thành" : "Đánh dấu hoàn thành"}
          />
        </Hint>

        {hasDateRange ? (
          <CardDatePopover
            open={isDateOpen}
            onOpenChange={onDateOpenChange}
            startDateValue={startDateValue}
            dueDateValue={dueDateValue}
            reminderValue={reminderValue}
            canSetReminder={canSetReminder}
            hasStartDate={hasStartDate}
            hasDueDate={hasDueDate}
            isLoadingUpdate={isLoadingUpdate}
            onStartDateValueChange={onStartDateValueChange}
            onDueDateValueChange={onDueDateValueChange}
            onReminderValueChange={onReminderValueChange}
            onSubmit={onDateSubmit}
            onClearStartDate={onClearStartDate}
            onClearDueDate={onClearDueDate}
            trigger={(
              <button
                type="button"
                className="inline-flex h-8 max-w-full items-center gap-x-1.5 rounded-lg border border-neutral-200 bg-neutral-50/50 hover:bg-neutral-50 active:bg-neutral-100 px-3 text-xs font-medium text-neutral-700 cursor-pointer transition-colors shadow-xs"
              >
                <span className="truncate">{dateSummary}</span>

                {data.isCompleted ? (
                  <span className="shrink-0 bg-emerald-600 text-white px-1.5 py-0.5 rounded text-[10px] font-bold">
                    Hoàn thành
                  </span>
                ) : status === "overdue" ? (
                  <span className="shrink-0 bg-red-600 text-white px-1.5 py-0.5 rounded text-[10px] font-bold">
                    Quá hạn
                  </span>
                ) : status === "warning" ? (
                  <span className="shrink-0 bg-yellow-500 text-white px-1.5 py-0.5 rounded text-[10px] font-bold">
                    Sắp hết hạn
                  </span>
                ) : null}

                <ChevronDown className="h-3.5 w-3.5 text-neutral-500 ml-0.5" />
              </button>
            )}
          />
        ) : (
          <span className={cn(
            "text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider shadow-xs",
            data.isCompleted
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "bg-neutral-50 text-neutral-500 border border-neutral-200"
          )}>
            {data.isCompleted ? "Hoàn thành" : "Chưa hoàn thành"}
          </span>
        )}
      </div>
    </div>
  );
};
