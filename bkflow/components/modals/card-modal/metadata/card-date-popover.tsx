"use client";

import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface CardDatePopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: React.ReactNode;
  startDateValue: string;
  dueDateValue: string;
  reminderValue: string;
  canSetReminder: boolean;
  hasStartDate: boolean;
  hasDueDate: boolean;
  isLoadingUpdate: boolean;
  onStartDateValueChange: (value: string) => void;
  onDueDateValueChange: (value: string) => void;
  onReminderValueChange: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onClearStartDate: () => void;
  onClearDueDate: () => void;
}

export const CardDatePopover = ({
  open,
  onOpenChange,
  trigger,
  startDateValue,
  dueDateValue,
  reminderValue,
  canSetReminder,
  hasStartDate,
  hasDueDate,
  isLoadingUpdate,
  onStartDateValueChange,
  onDueDateValueChange,
  onReminderValueChange,
  onSubmit,
  onClearStartDate,
  onClearDueDate,
}: CardDatePopoverProps) => {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        {trigger}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[300px] p-3 rounded-xl border border-neutral-200 shadow-xl bg-white z-[9999]" sideOffset={6}>
        <div className="relative pb-2.5 mb-3 border-b border-neutral-100 flex items-center justify-between">
          <span className="text-sm font-semibold text-neutral-700 mx-auto">Ngày</span>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="absolute right-0 top-0.5 text-neutral-400 hover:text-neutral-600 rounded-sm"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="flex flex-col gap-y-1">
            <span className="text-[11px] font-bold text-neutral-500 uppercase">
              Ngày và giờ bắt đầu
            </span>
            <input
              name="startDate"
              aria-label="Ngày và giờ bắt đầu"
              type="datetime-local"
              value={startDateValue}
              onChange={(event) => onStartDateValueChange(event.target.value)}
              disabled={isLoadingUpdate}
              className="h-9 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-700 shadow-xs outline-none transition focus:border-violet-500 focus:ring-1 focus:ring-violet-200"
            />
          </div>
          <div className="flex flex-col gap-y-1">
            <span className="text-[11px] font-bold text-neutral-500 uppercase">
              Ngày và giờ hết hạn
            </span>
            <input
              name="dueDate"
              aria-label="Ngày và giờ hết hạn"
              type="datetime-local"
              value={dueDateValue}
              onChange={(event) => {
                onDueDateValueChange(event.target.value);
                if (!event.target.value) {
                  onReminderValueChange("none");
                }
              }}
              disabled={isLoadingUpdate}
              className="h-9 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-700 shadow-xs outline-none transition focus:border-violet-500 focus:ring-1 focus:ring-violet-200"
            />
          </div>

          <div className="flex flex-col gap-y-1">
            <span className="text-[11px] font-bold text-neutral-500 uppercase">
              Thiết lập nhắc nhở
            </span>
            <select
              name="reminder"
              aria-label="Thiết lập nhắc nhở"
              value={reminderValue}
              onChange={(event) => onReminderValueChange(event.target.value)}
              disabled={isLoadingUpdate || !canSetReminder}
              className="h-9 w-full rounded-lg border border-neutral-200 bg-white px-2.5 text-sm text-neutral-700 shadow-xs outline-none transition focus:border-violet-500 focus:ring-1 focus:ring-violet-200 disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-400 cursor-pointer"
            >
              <option value="none">Không có</option>
              <option value="0">Vào thời điểm hết hạn</option>
              <option value="5">5 phút trước</option>
              <option value="10">10 phút trước</option>
              <option value="15">15 phút trước</option>
              <option value="30">30 phút trước</option>
              <option value="60">1 giờ trước</option>
              <option value="120">2 giờ trước</option>
              <option value="1440">1 ngày trước</option>
              <option value="2880">2 ngày trước</option>
              <option value="10080">1 tuần trước</option>
              <option value="20160">2 tuần trước</option>
            </select>
          </div>

          <div className="flex items-center gap-x-2 pt-1">
            <Button
              type="submit"
              size="sm"
              disabled={isLoadingUpdate}
              className="h-8 rounded-lg bg-violet-600 px-4 text-xs text-white hover:bg-violet-700"
            >
              Lưu
            </Button>
            {hasStartDate && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={isLoadingUpdate}
                onClick={onClearStartDate}
                className="h-8 rounded-lg text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 text-xs px-3"
                aria-label="Xóa ngày bắt đầu"
              >
                Xóa bắt đầu
              </Button>
            )}
            {hasDueDate && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={isLoadingUpdate}
                onClick={onClearDueDate}
                className="h-8 rounded-lg text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 text-xs px-3"
                aria-label="Xóa ngày hết hạn"
              >
                Xóa hết hạn
              </Button>
            )}
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
};
