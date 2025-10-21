"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Clock, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Hint } from "@/components/hint";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface ChecklistItemDueDateProps {
  dueDate: Date | string | null;
  isCompleted: boolean;
  isPending: boolean;
  onChange: (dueDate: Date | null) => void;
}

const toDateTimeLocalValue = (date?: Date | string | null) => {
  if (!date) {
    return "";
  }

  const parsedDate = new Date(date);
  const timezoneOffset = parsedDate.getTimezoneOffset() * 60_000;

  return new Date(parsedDate.getTime() - timezoneOffset).toISOString().slice(0, 16);
};

export const isChecklistItemOverdue = (
  dueDate: Date | string | null,
  isCompleted: boolean,
) => Boolean(dueDate && !isCompleted && new Date(dueDate).getTime() < Date.now());

export const ChecklistItemDueDate = ({
  dueDate,
  isCompleted,
  isPending,
  onChange,
}: ChecklistItemDueDateProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [value, setValue] = useState(toDateTimeLocalValue(dueDate));

  useEffect(() => {
    setValue(toDateTimeLocalValue(dueDate));
  }, [dueDate]);

  const overdue = isChecklistItemOverdue(dueDate, isCompleted);

  const save = () => {
    if (!value) {
      onChange(null);
      setIsOpen(false);
      return;
    }

    const nextDate = new Date(value);

    if (Number.isNaN(nextDate.getTime())) {
      return;
    }

    onChange(nextDate);
    setIsOpen(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <Hint description={dueDate ? "Sửa ngày hết hạn" : "Thêm ngày hết hạn"}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={isPending}
            className={cn(
              "inline-flex h-7 max-w-full items-center gap-x-1 rounded-md border px-2 text-xs font-medium shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 disabled:opacity-50",
              dueDate && !overdue && "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50",
              overdue && "border-red-200 bg-red-50 text-red-700 hover:bg-red-100",
              !dueDate && "border-transparent bg-transparent text-neutral-400 opacity-0 hover:bg-neutral-100 group-hover:opacity-100 focus:opacity-100",
              isCompleted && dueDate && "border-emerald-200 bg-emerald-50 text-emerald-700",
            )}
            aria-label={dueDate ? "Sửa ngày hết hạn" : "Thêm ngày hết hạn"}
          >
            <Clock className="h-3.5 w-3.5 shrink-0" />
            {dueDate && (
              <span className="truncate">
                {format(new Date(dueDate), "dd/MM HH:mm")}
              </span>
            )}
          </button>
        </PopoverTrigger>
      </Hint>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="z-[9999] w-[min(300px,calc(100vw-2rem))] rounded-xl border border-neutral-200 bg-white p-3 shadow-xl"
        onEscapeKeyDown={() => setIsOpen(false)}
      >
        <div className="mb-3 flex items-center justify-between border-b border-neutral-100 pb-2">
          <span className="text-sm font-semibold text-neutral-700">Ngày hết hạn</span>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={() => setIsOpen(false)}
            aria-label="Dong"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="space-y-3">
          <input
            type="datetime-local"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            disabled={isPending}
            className="h-9 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-700 shadow-xs outline-none transition focus:border-violet-500 focus:ring-1 focus:ring-violet-200"
          />
          <div className="flex items-center gap-x-2">
            <Button
              type="button"
              size="sm"
              disabled={isPending}
              onClick={save}
              className="h-8 rounded-lg bg-violet-600 px-4 text-xs text-white hover:bg-violet-700"
            >
              Lưu
            </Button>
            {dueDate && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={isPending}
                onClick={() => {
                  setValue("");
                  onChange(null);
                  setIsOpen(false);
                }}
                className="h-8 rounded-lg px-3 text-xs text-neutral-500 hover:bg-neutral-100"
              >
                Xoá
              </Button>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
