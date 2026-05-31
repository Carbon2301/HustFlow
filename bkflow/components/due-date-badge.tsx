"use client";

import { format } from "date-fns";
import { Clock } from "lucide-react";

import { cn } from "@/lib/utils";
import { Hint } from "@/components/hint";
import { isOverdue } from "@/lib/date-utils";
import { useHasMounted } from "@/hooks/use-has-mounted";

interface DueDateBadgeProps {
  dueDate?: Date | string | null;
  startDate?: Date | string | null;
  isCompleted?: boolean;
  className?: string;
  isCard?: boolean;
}

export const getDueDateStatus = (
  dueDate: Date | string,
  isCompleted = false,
  now = new Date(),
) => {
  if (isCompleted) {
    return "completed";
  }

  const date = new Date(dueDate);
  const dayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  if (isOverdue(date, now)) {
    return "overdue";
  }

  if (date <= dayFromNow) {
    return "warning";
  }

  return "normal";
};

export const DueDateBadge = ({
  dueDate,
  startDate,
  isCompleted = false,
  className,
  isCard = false,
}: DueDateBadgeProps) => {
  const hasMounted = useHasMounted();

  if (!startDate && !dueDate) {
    return null;
  }

  const hasStart = !!startDate;
  const hasDue = !!dueDate;
  const now = hasMounted ? new Date() : null;

  const status = isCompleted
    ? "completed"
    : (hasDue && now ? getDueDateStatus(dueDate, isCompleted, now) : "normal");

  let tooltipText = "";
  if (isCompleted) {
    tooltipText = "Thẻ đã hoàn thành";
  } else if (hasDue) {
    if (status === "overdue") {
      tooltipText = "Thẻ đã hết hạn";
    } else if (status === "warning") {
      tooltipText = "Thẻ sắp hết hạn";
    } else {
      tooltipText = "Thẻ còn hạn";
    }
  } else {
    tooltipText = "Thẻ đã bắt đầu";
  }

  const formatDateValue = (d: Date | string) => {
    const dateObj = new Date(d);
    const isCurrentYear = now
      ? dateObj.getFullYear() === now.getFullYear()
      : false;
    const formatStr = isCard
      ? (isCurrentYear ? "dd/MM HH:mm" : "dd/MM/yy HH:mm")
      : "dd/MM/yyyy HH:mm";
    return format(dateObj, formatStr);
  };

  let displayString = "";
  if (hasStart && !hasDue) {
    displayString = `Bắt đầu: ${formatDateValue(startDate)}`;
  } else if (hasStart && hasDue) {
    displayString = `${formatDateValue(startDate)} - ${formatDateValue(dueDate)}`;
  } else if (hasDue) {
    displayString = formatDateValue(dueDate);
  }

  return (
    <Hint description={tooltipText} side="bottom">
      <span
        className={cn(
          "inline-flex h-7 max-w-full items-center rounded-md border text-xs font-medium shadow-sm !cursor-pointer",
          isCard ? "px-2 gap-x-1" : "px-2.5 gap-x-1.5",
          status === "normal" && "border-neutral-200 bg-white text-neutral-600",
          status === "warning" && "border-yellow-200 bg-yellow-50 text-yellow-700",
          status === "overdue" && "border-red-200 bg-red-50 text-red-700",
          status === "completed" && "border-emerald-200 bg-emerald-50 text-emerald-700",
          className,
        )}
      >
        <Clock className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{displayString}</span>
      </span>
    </Hint>
  );
};
