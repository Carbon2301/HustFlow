"use client";

import type { ChangeEvent, FormEvent } from "react";
import type { QueryClient } from "@tanstack/react-query";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { toast } from "sonner";

import type { CardWithList } from "@/types";
import { useAction } from "@/hooks/use-action";
import { updateCard } from "@/actions/update-card";
import { assignCardMember } from "@/actions/assign-card-member";
import { unassignCardMember } from "@/actions/unassign-card-member";
import {
  getDateTimezoneOffset,
  parseDateTimeLocalInput,
} from "@/lib/date-utils";

import { humanizeReminderMinutes } from "./metadata-utils";

interface UseCardMetadataActionsProps {
  data: CardWithList;
  boardId: string;
  router: AppRouterInstance;
  queryClient: QueryClient;
  invalidateBoardCalendar: () => void;
  reminderValue: string;
  setIsDateOpen: (open: boolean) => void;
}

export const useCardMetadataActions = ({
  data,
  boardId,
  router,
  queryClient,
  invalidateBoardCalendar,
  reminderValue,
  setIsDateOpen,
}: UseCardMetadataActionsProps) => {
  const { execute: executeUpdateCard, isLoading: isLoadingUpdate } = useAction(updateCard, {
    onSuccess: (updatedCard) => {
      queryClient.invalidateQueries({
        queryKey: ["card", updatedCard.id],
      });
      queryClient.invalidateQueries({
        queryKey: ["card-logs", updatedCard.id],
      });
      invalidateBoardCalendar();
      router.refresh();

      if (updatedCard.isCompleted !== data.isCompleted) {
        toast.success(
          updatedCard.isCompleted
            ? "Đã đánh dấu hoàn thành thẻ"
            : "Đã bỏ đánh dấu hoàn thành thẻ"
        );
      } else {
        toast.success("Đã cập nhật lịch biểu");
      }
      setIsDateOpen(false);
    },
    onError: (error) => {
      toast.error(error);
    },
  });

  const { execute: executeAssign, isLoading: isLoadingAssign } = useAction(assignCardMember, {
    onSuccess: (assigned) => {
      invalidateBoardCalendar();
      queryClient.invalidateQueries({
        queryKey: ["card", data.id],
      });
      queryClient.invalidateQueries({
        queryKey: ["card-logs", data.id],
      });
      toast.success(`Đã giao thẻ cho ${assigned.boardMember.userName}`);
    },
    onError: (error) => {
      toast.error(error);
    },
  });

  const { execute: executeUnassign, isLoading: isLoadingUnassign } = useAction(unassignCardMember, {
    onSuccess: (unassigned) => {
      invalidateBoardCalendar();
      queryClient.invalidateQueries({
        queryKey: ["card", data.id],
      });
      queryClient.invalidateQueries({
        queryKey: ["card-logs", data.id],
      });
      toast.success(`Đã bỏ giao thẻ cho ${unassigned.boardMember.userName}`);
    },
    onError: (error) => {
      toast.error(error);
    },
  });

  const updateDateRange = ({
    startDate,
    dueDate,
    isCompleted,
    reminder,
  }: {
    startDate?: Date | null;
    dueDate?: Date | null;
    isCompleted?: boolean;
    reminder?: string | null;
  }) => {
    if (
      startDate === undefined &&
      dueDate === undefined &&
      (isCompleted === undefined || isCompleted === data.isCompleted) &&
      (reminder === undefined || reminder === (data.reminder || "none"))
    ) {
      return;
    }

    const nextIsCompleted = dueDate === undefined
      ? isCompleted
      : (dueDate ? (isCompleted ?? data.isCompleted) : false);
    const nextReminder = dueDate === undefined
      ? reminder
      : (dueDate ? (reminder ?? reminderValue) : null);

    executeUpdateCard({
      id: data.id,
      boardId,
      ...(startDate !== undefined ? { startDate } : {}),
      ...(dueDate !== undefined ? { dueDate } : {}),
      dueDateTimezoneOffset: dueDate
        ? getDateTimezoneOffset(dueDate)
        : startDate
          ? getDateTimezoneOffset(startDate)
          : undefined,
      ...(nextIsCompleted !== undefined ? { isCompleted: nextIsCompleted } : {}),
      ...(nextReminder !== undefined ? { reminder: nextReminder } : {}),
    });
  };

  const updateDueDate = (
    dueDate: Date | null,
    isCompleted = data.isCompleted,
    reminder = reminderValue,
  ) => {
    updateDateRange({ dueDate, isCompleted, reminder });
  };

  const updateStartDate = (startDate: Date | null) => {
    if (
      (startDate === null && !data.startDate) ||
      (startDate && data.startDate && startDate.getTime() === new Date(data.startDate).getTime())
    ) {
      return;
    }

    updateDateRange({ startDate });
  };

  const onDateSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const startValue = formData.get("startDate") as string;
    const value = formData.get("dueDate") as string;
    const reminder = formData.get("reminder") as string;

    const parsedStartDate = startValue
      ? parseDateTimeLocalInput(startValue)
      : null;
    const parsedDueDate = value
      ? parseDateTimeLocalInput(value)
      : null;

    const normReminder = reminder === "none" || !reminder ? "none" : reminder;
    const normOldReminder = data.reminder === "none" || !data.reminder ? "none" : data.reminder;

    const startDateChanged = (parsedStartDate?.getTime() ?? null) !== (data.startDate ? new Date(data.startDate).getTime() : null);
    const dueDateChanged = (parsedDueDate?.getTime() ?? null) !== (data.dueDate ? new Date(data.dueDate).getTime() : null);
    const reminderChanged = normReminder !== normOldReminder;

    if (!startDateChanged && !dueDateChanged && !reminderChanged) {
      setIsDateOpen(false);
      return;
    }

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
            toast.error(
              `Thời gian nhắc nhở không hợp lệ. Thẻ chỉ còn ${humanizeReminderMinutes(minutesUntilDue)} — hãy chọn mốc nhắc ngắn hơn.`
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

  const onToggleComplete = (event: ChangeEvent<HTMLInputElement>) => {
    const checked = event.target.checked;
    executeUpdateCard({
      id: data.id,
      boardId,
      isCompleted: checked,
    });
  };

  const handleMemberToggle = (memberId: string, isAssigned: boolean) => {
    if (isAssigned) {
      executeUnassign({
        boardId,
        cardId: data.id,
        boardMemberId: memberId,
      });
    } else {
      executeAssign({
        boardId,
        cardId: data.id,
        boardMemberId: memberId,
      });
    }
  };

  return {
    isLoadingUpdate,
    isLoadingAssign,
    isLoadingUnassign,
    updateDateRange,
    updateDueDate,
    updateStartDate,
    onDateSubmit,
    onToggleComplete,
    handleMemberToggle,
  };
};
