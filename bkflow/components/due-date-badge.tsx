"use client";

import { format } from "date-fns";
import { Clock } from "lucide-react";

import { cn } from "@/lib/utils";
import { Hint } from "@/components/hint";

interface DueDateBadgeProps {
  dueDate: Date | string;
  isCompleted?: boolean;
  className?: string;
  isCard?: boolean;
}

export const getDueDateStatus = (dueDate: Date | string) => {
  const date = new Date(dueDate);
  const now = new Date();
  const dayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  if (date < now) {
    return "overdue";
  }

  if (date <= dayFromNow) {
    return "warning";
  }

  return "normal";
};

export const DueDateBadge = ({
  dueDate,
  isCompleted = false,
  className,
  isCard = false,
}: DueDateBadgeProps) => {
  const status = getDueDateStatus(dueDate);

  let tooltipText = "";
  if (isCompleted) {
    tooltipText = "Thẻ đã hoàn thành";
  } else if (status === "overdue") {
    tooltipText = "Thẻ đã hết hạn";
  } else if (status === "warning") {
    tooltipText = "Thẻ sắp hết hạn";
  } else {
    tooltipText = "Thẻ còn hạn";
  }

  const isCurrentYear = new Date(dueDate).getFullYear() === new Date().getFullYear();
  const formatStr = isCard 
    ? (isCurrentYear ? "dd/MM HH:mm" : "dd/MM/yy HH:mm") 
    : "dd/MM/yyyy HH:mm";

  return (
    <Hint description={tooltipText} side="bottom">
      <span
        className={cn(
          "inline-flex h-7 max-w-full items-center rounded-md border text-xs font-medium shadow-sm !cursor-pointer",
          isCard ? "px-2 gap-x-1" : "px-2.5 gap-x-1.5",
          status === "normal" && "border-neutral-200 bg-white text-neutral-600",
          status === "warning" && "border-yellow-200 bg-yellow-50 text-yellow-700",
          status === "overdue" && "border-red-200 bg-red-50 text-red-700",
          isCompleted && "border-emerald-200 bg-emerald-50 text-emerald-700",
          className,
        )}
      >
        <Clock className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{format(new Date(dueDate), formatStr)}</span>
      </span>
    </Hint>
  );
};
