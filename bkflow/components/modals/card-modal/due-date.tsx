"use client";

import { toast } from "sonner";
import { Clock, X } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { CardWithList } from "@/types";
import { useAction } from "@/hooks/use-action";
import { updateCard } from "@/actions/update-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DueDateBadge } from "@/components/due-date-badge";
import {
  formatDateTimeLocalInput,
  getDateTimezoneOffset,
  parseDateTimeLocalInput,
} from "@/lib/date-utils";

interface DueDateProps {
  data: CardWithList;
}

export const DueDate = ({
  data,
}: DueDateProps) => {
  const params = useParams();
  const queryClient = useQueryClient();
  const [startDateValue, setStartDateValue] = useState(
    formatDateTimeLocalInput(data.startDate),
  );
  const [dueDateValue, setDueDateValue] = useState(
    formatDateTimeLocalInput(data.dueDate),
  );
  const [reminderValue, setReminderValue] = useState(data.reminder || "none");

  useEffect(() => {
    setStartDateValue(formatDateTimeLocalInput(data.startDate));
    setDueDateValue(formatDateTimeLocalInput(data.dueDate));
    setReminderValue(data.reminder || "none");
  }, [data.startDate, data.dueDate, data.reminder]);

  const { execute, isLoading } = useAction(updateCard, {
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ["card", data.id],
      });
      queryClient.invalidateQueries({
        queryKey: ["card-logs", data.id],
      });
    },
    onError: (error) => {
      toast.error(error);
    },
  });

  const updateDateRange = ({
    startDate,
    dueDate,
    isCompleted = data.isCompleted,
    reminder = reminderValue,
  }: {
    startDate?: Date | null;
    dueDate?: Date | null;
    isCompleted?: boolean;
    reminder?: string | null;
  }) => {
    const boardId = params.boardId as string;

    execute({
      id: data.id,
      boardId,
      ...(startDate !== undefined ? { startDate } : {}),
      ...(dueDate !== undefined ? { dueDate } : {}),
      dueDateTimezoneOffset: dueDate
        ? getDateTimezoneOffset(dueDate)
        : startDate
          ? getDateTimezoneOffset(startDate)
          : undefined,
      isCompleted: dueDate === undefined
        ? isCompleted
        : (dueDate ? isCompleted : false),
      reminder: dueDate === undefined
        ? reminder
        : (dueDate ? reminder : null),
    });
  };

  const updateDueDate = (
    dueDate: Date | null,
    isCompleted = data.isCompleted,
    reminder = reminderValue,
  ) => {
    updateDateRange({ dueDate, isCompleted, reminder });
  };

  const onSubmit = (formData: FormData) => {
    const startValue = formData.get("startDate") as string;
    const value = formData.get("dueDate") as string;
    const reminder = formData.get("reminder") as string;
    const currentStartFormatted = formatDateTimeLocalInput(data.startDate);
    const currentDueFormatted = formatDateTimeLocalInput(data.dueDate);
    const currentReminder = data.reminder || "none";

    if (
      startValue === currentStartFormatted &&
      value === currentDueFormatted &&
      reminder === currentReminder
    ) {
      return;
    }

    const parsedStartDate = startValue
      ? parseDateTimeLocalInput(startValue)
      : null;
    const parsedDueDate = value
      ? parseDateTimeLocalInput(value)
      : null;

    if (startValue && !parsedStartDate) {
      toast.error("Ngày bắt đầu không hợp lệ.");
      return;
    }

    if (value && !parsedDueDate) {
      toast.error("Ngày hết hạn không hợp lệ.");
      return;
    }

    if (
      parsedStartDate &&
      parsedDueDate &&
      parsedStartDate.getTime() > parsedDueDate.getTime()
    ) {
      toast.error("Ngày bắt đầu phải trước hoặc bằng ngày hết hạn.");
      return;
    }

    if (!parsedDueDate && reminder && reminder !== "none") {
      toast.error("Vui lòng đặt ngày hết hạn trước khi thiết lập nhắc nhở.");
      return;
    }

    if (parsedDueDate && reminder && reminder !== "none") {
      const offsetMinutes = parseInt(reminder, 10);

      if (!Number.isNaN(offsetMinutes)) {
        const dueDateTime = parsedDueDate.getTime();
        const triggerTime = dueDateTime - offsetMinutes * 60 * 1000;
        const now = Date.now();

        if (triggerTime < now) {
          const minutesUntilDue = Math.floor((dueDateTime - now) / 60_000);

          if (minutesUntilDue <= 0) {
            toast.error("Thẻ đã hết hạn. Vui lòng cập nhật ngày hết hạn trước.");
          } else {
            const humanize = (mins: number) => {
              if (mins >= 1440) return `${Math.floor(mins / 1440)} ngày`;
              if (mins >= 60) return `${Math.floor(mins / 60)} giờ`;
              return `${mins} phút`;
            };

            toast.error(
              `Thời gian nhắc nhở không hợp lệ. Thẻ chỉ còn ${humanize(minutesUntilDue)}; hãy chọn mốc nhắc ngắn hơn.`,
            );
          }

          return;
        }
      }
    }

    updateDateRange({
      startDate: parsedStartDate,
      dueDate: parsedDueDate,
      isCompleted: data.isCompleted,
      reminder,
    });
  };

  const onToggleComplete = (checked: boolean) => {
    if (!data.dueDate) {
      return;
    }

    updateDueDate(new Date(data.dueDate), checked, reminderValue);
  };

  return (
    <div className="flex items-start gap-x-4 w-full">
      <div className="w-10 h-10 rounded-xl bg-neutral-100 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Clock className="h-5 w-5 text-neutral-500" />
      </div>
      <div className="w-full min-w-0">
        <p className="font-semibold text-base text-neutral-800 mb-2.5">
          Ngày
        </p>
        <div className="flex flex-wrap items-center gap-2.5">
          {data.dueDate && (
            <>
              <label className="inline-flex h-7 items-center gap-x-2 rounded-md border border-neutral-200 bg-white px-2.5 text-xs font-medium text-neutral-600 shadow-sm">
                <input
                  type="checkbox"
                  checked={data.isCompleted}
                  onChange={(event) => onToggleComplete(event.target.checked)}
                  disabled={isLoading}
                  className="h-3.5 w-3.5 rounded border-neutral-300 accent-violet-600"
                />
                Hoàn thành
              </label>
              <DueDateBadge
                dueDate={data.dueDate}
                isCompleted={data.isCompleted}
              />
            </>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onSubmit(new FormData(e.currentTarget));
            }}
            className="flex flex-wrap items-end gap-3 w-full mt-2"
          >
            <div className="flex flex-col gap-y-1.5">
              <span className="text-xs font-semibold text-neutral-500">
                Ngày và giờ bắt đầu
              </span>
              <input
                name="startDate"
                type="datetime-local"
                value={startDateValue}
                onChange={(event) => setStartDateValue(event.target.value)}
                disabled={isLoading}
                className="h-9 rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-700 shadow-sm outline-none transition focus:border-violet-400 focus:ring-1 focus:ring-violet-200"
              />
            </div>

            <div className="flex flex-col gap-y-1.5">
              <span className="text-xs font-semibold text-neutral-500">
                Ngày và giờ hết hạn
              </span>
              <input
                name="dueDate"
                type="datetime-local"
                value={dueDateValue}
                onChange={(event) => setDueDateValue(event.target.value)}
                disabled={isLoading}
                className="h-9 rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-700 shadow-sm outline-none transition focus:border-violet-400 focus:ring-1 focus:ring-violet-200"
              />
            </div>

            <div className="flex flex-col gap-y-1.5 min-w-[180px]">
              <span className="text-xs font-semibold text-neutral-500">
                Thiết lập nhắc nhở
              </span>
              <select
                name="reminder"
                value={reminderValue}
                onChange={(event) => setReminderValue(event.target.value)}
                disabled={isLoading}
                className="h-9 rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-700 shadow-sm outline-none transition focus:border-violet-400 focus:ring-1 focus:ring-violet-200 cursor-pointer"
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

            <div className="flex items-center gap-x-2 h-9">
              <Button
                type="submit"
                size="sm"
                disabled={isLoading}
                className="h-9 rounded-lg bg-violet-600 px-4 text-sm text-white hover:bg-violet-700"
              >
                Lưu
              </Button>
              {data.dueDate && (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  disabled={isLoading}
                  onClick={() => updateDueDate(null)}
                  className="h-9 w-9 rounded-lg text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                  aria-label="Xóa ngày hết hạn"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

DueDate.Skeleton = function DueDateSkeleton() {
  return (
    <div className="flex items-start gap-x-4 w-full">
      <Skeleton className="h-10 w-10 rounded-xl bg-neutral-100" />
      <div className="w-full space-y-3">
        <Skeleton className="w-28 h-5 rounded bg-neutral-100" />
        <Skeleton className="w-56 h-8 rounded-lg bg-neutral-100" />
      </div>
    </div>
  );
};
