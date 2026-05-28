"use client";

import { FormEvent, useRef, useState } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { CardWithList } from "@/types";
import { useAction } from "@/hooks/use-action";
import { updateCard } from "@/actions/cards/update-card";
import { assignCardMember } from "@/actions/cards/assign-card-member";
import { unassignCardMember } from "@/actions/cards/unassign-card-member";
import {
  getDateTimezoneOffset,
  parseDateTimeLocalInput,
} from "@/lib/date-utils";

import { humanizeReminderMinutes } from "./metadata-utils";
import {
  mergeCardAssignee,
  patchBoardCardPreview,
  patchCardQueryData,
  removeCardAssignee,
  scheduleCoalescedCardRefetch,
} from "../card-cache-utils";

interface UseCardMetadataActionsProps {
  data: CardWithList;
  boardId: string;
  queryClient: QueryClient;
  invalidateBoardCalendar: () => void;
  reminderValue: string;
  setIsDateOpen: (open: boolean) => void;
}

export const useCardMetadataActions = ({
  data,
  boardId,
  queryClient,
  invalidateBoardCalendar,
  reminderValue,
  setIsDateOpen,
}: UseCardMetadataActionsProps) => {
  const dateRequestRef = useRef<{
    previousStartDate: CardWithList["startDate"];
    previousDueDate: CardWithList["dueDate"];
    previousReminder: CardWithList["reminder"];
    previousIsCompleted: CardWithList["isCompleted"];
  } | null>(null);
  const memberRequestsRef = useRef(new Map<string, {
    previousAssignee: CardWithList["assignees"][number] | null;
    sentAssigned: boolean;
    queuedAssigned: boolean | null;
    version: number;
  }>());
  const memberRequestVersionsRef = useRef(new Map<string, number>());
  const memberPendingCountRef = useRef(0);
  const [assignPendingCount, setAssignPendingCount] = useState(0);
  const [unassignPendingCount, setUnassignPendingCount] = useState(0);

  const { execute: executeUpdateCard, isLoading: isLoadingUpdate } = useAction(updateCard, {
    onSuccess: (updatedCard) => {
      dateRequestRef.current = null;
      patchCardQueryData(queryClient, updatedCard.id, {
        startDate: updatedCard.startDate,
        dueDate: updatedCard.dueDate,
        isCompleted: updatedCard.isCompleted,
        reminder: updatedCard.reminder,
        reminderSetAt: updatedCard.reminderSetAt,
      });
      patchBoardCardPreview(boardId, updatedCard.id, {
        startDate: updatedCard.startDate,
        dueDate: updatedCard.dueDate,
        isCompleted: updatedCard.isCompleted,
        reminder: updatedCard.reminder,
        reminderSetAt: updatedCard.reminderSetAt,
      });
      queryClient.invalidateQueries({
        queryKey: ["card-logs", updatedCard.id],
      });
      invalidateBoardCalendar();

      if (updatedCard.isCompleted !== data.isCompleted) {
        const relatedDependencyCardIds = [
          ...data.blockedByDependencies.map((dependency) => dependency.blockerCardId),
          ...data.blockingDependencies.map((dependency) => dependency.blockedCardId),
        ];

        Array.from(new Set(relatedDependencyCardIds)).forEach((cardId) => {
          queryClient.invalidateQueries({
            queryKey: ["card", cardId],
          });
        });
      }
      setIsDateOpen(false);
    },
    onError: (error) => {
      const request = dateRequestRef.current;
      if (request) {
        patchCardQueryData(queryClient, data.id, {
          startDate: request.previousStartDate,
          dueDate: request.previousDueDate,
          reminder: request.previousReminder,
          isCompleted: request.previousIsCompleted,
        });
        patchBoardCardPreview(boardId, data.id, {
          startDate: request.previousStartDate,
          dueDate: request.previousDueDate,
          reminder: request.previousReminder,
          isCompleted: request.previousIsCompleted,
        });
        dateRequestRef.current = null;
      }
      toast.error(error);
    },
  });

  const getCurrentAssignees = () =>
    queryClient.getQueryData<CardWithList>(["card", data.id])?.assignees ?? data.assignees;

  const patchAssignees = (assignees: CardWithList["assignees"]) => {
    patchCardQueryData(queryClient, data.id, {
      assignees,
    });
    patchBoardCardPreview(boardId, data.id, {
      assignees,
    });
  };

  const getOptimisticAssignee = (memberId: string): CardWithList["assignees"][number] | null => {
    const boardMember = data.boardMembers.find((member) => member.id === memberId);

    if (!boardMember) {
      return null;
    }

    const now = new Date();

    return {
      id: `temp-assignee-${data.id}-${memberId}`,
      cardId: data.id,
      boardMemberId: memberId,
      createdAt: now,
      updatedAt: now,
      boardMember,
    };
  };

  const getNextMemberRequestVersion = (memberId: string) => {
    const nextVersion = (memberRequestVersionsRef.current.get(memberId) ?? 0) + 1;
    memberRequestVersionsRef.current.set(memberId, nextVersion);
    return nextVersion;
  };

  const finishMemberSuccess = (
    memberId: string,
    sentAssigned: boolean,
    nextAssignees: CardWithList["assignees"],
    successMessage: string,
    version: number,
  ) => {
    const request = memberRequestsRef.current.get(memberId);

    if (!request || request.version !== version || request.sentAssigned !== sentAssigned) {
      return;
    }

    invalidateBoardCalendar();
    queryClient.invalidateQueries({
      queryKey: ["card-logs", data.id],
    });
    toast.success(successMessage);

    const queuedAssigned = request.queuedAssigned;
    memberRequestsRef.current.delete(memberId);

    if (queuedAssigned !== null && queuedAssigned !== sentAssigned) {
      sendMemberMutation(memberId, queuedAssigned, nextAssignees);
      return;
    }

    patchAssignees(nextAssignees);
  };

  const finishMemberError = (
    memberId: string,
    sentAssigned: boolean,
    version: number,
    error: string,
  ) => {
    const request = memberRequestsRef.current.get(memberId);

    if (request && request.version === version && request.sentAssigned === sentAssigned) {
      const currentAssignees = getCurrentAssignees();
      const assignees = request.previousAssignee
        ? mergeCardAssignee(currentAssignees, request.previousAssignee)
        : removeCardAssignee(currentAssignees, memberId);

      patchAssignees(assignees);
      memberRequestsRef.current.delete(memberId);
    }

    toast.error(error);
  };

  const executeAssignMember = async (memberId: string, version: number) => {
    memberPendingCountRef.current += 1;
    setAssignPendingCount((count) => count + 1);

    try {
      const result = await assignCardMember({
        boardId,
        cardId: data.id,
        boardMemberId: memberId,
      });

      if (result.error) {
        finishMemberError(memberId, true, version, result.error);
        return;
      }

      if (result.data) {
        const assigned = result.data;
        const assignees = mergeCardAssignee(getCurrentAssignees(), assigned);

        finishMemberSuccess(
          assigned.boardMemberId,
          true,
          assignees,
          `Đã giao thẻ cho ${assigned.boardMember.userName}`,
          version,
        );
      }

      if (!result.data) {
        finishMemberError(
          memberId,
          true,
          version,
          "Có lỗi xảy ra khi cập nhật thành viên.",
        );
      }
    } catch {
      finishMemberError(
        memberId,
        true,
        version,
        "Có lỗi xảy ra khi cập nhật thành viên.",
      );
    } finally {
      memberPendingCountRef.current = Math.max(0, memberPendingCountRef.current - 1);
      setAssignPendingCount((count) => Math.max(0, count - 1));

      if (memberPendingCountRef.current === 0) {
        scheduleCoalescedCardRefetch(queryClient, data.id);
      }
    }
  };

  const executeUnassignMember = async (memberId: string, version: number) => {
    memberPendingCountRef.current += 1;
    setUnassignPendingCount((count) => count + 1);

    try {
      const result = await unassignCardMember({
        boardId,
        cardId: data.id,
        boardMemberId: memberId,
      });

      if (result.error) {
        finishMemberError(memberId, false, version, result.error);
        return;
      }

      if (result.data) {
        const unassigned = result.data;
        const assignees = removeCardAssignee(
          getCurrentAssignees(),
          unassigned.boardMemberId,
        );

        finishMemberSuccess(
          unassigned.boardMemberId,
          false,
          assignees,
          `Đã bỏ giao thẻ cho ${unassigned.boardMember.userName}`,
          version,
        );
      }

      if (!result.data) {
        finishMemberError(
          memberId,
          false,
          version,
          "Có lỗi xảy ra khi cập nhật thành viên.",
        );
      }
    } catch {
      finishMemberError(
        memberId,
        false,
        version,
        "Có lỗi xảy ra khi cập nhật thành viên.",
      );
    } finally {
      memberPendingCountRef.current = Math.max(0, memberPendingCountRef.current - 1);
      setUnassignPendingCount((count) => Math.max(0, count - 1));

      if (memberPendingCountRef.current === 0) {
        scheduleCoalescedCardRefetch(queryClient, data.id);
      }
    }
  };

  const sendMemberMutation = (
    memberId: string,
    desiredAssigned: boolean,
    previousAssignees: CardWithList["assignees"],
  ) => {
    const version = getNextMemberRequestVersion(memberId);

    memberRequestsRef.current.set(memberId, {
      previousAssignee: previousAssignees.find((item) => item.boardMemberId === memberId) ?? null,
      sentAssigned: desiredAssigned,
      queuedAssigned: null,
      version,
    });

    if (desiredAssigned) {
      void executeAssignMember(memberId, version);
      return;
    }

    void executeUnassignMember(memberId, version);
  };

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
    if (isLoadingUpdate || dateRequestRef.current) {
      return;
    }

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

    dateRequestRef.current = {
      previousStartDate: data.startDate,
      previousDueDate: data.dueDate,
      previousReminder: data.reminder,
      previousIsCompleted: data.isCompleted,
    };

    const patchObj: Partial<CardWithList> = {};
    if (startDate !== undefined) patchObj.startDate = startDate;
    if (dueDate !== undefined) patchObj.dueDate = dueDate;
    if (nextIsCompleted !== undefined) patchObj.isCompleted = nextIsCompleted;
    if (nextReminder !== undefined) patchObj.reminder = nextReminder === "none" ? null : nextReminder;

    patchCardQueryData(queryClient, data.id, patchObj);
    patchBoardCardPreview(boardId, data.id, patchObj);

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

  const updateCompletion = (checked: boolean) => {
    executeUpdateCard({
      id: data.id,
      boardId,
      isCompleted: checked,
    });
  };

  const handleMemberToggle = async (memberId: string, isAssigned: boolean) => {
    const desiredAssigned = !isAssigned;
    const activeRequest = memberRequestsRef.current.get(memberId);
    const currentAssignees = getCurrentAssignees();
    await queryClient.cancelQueries({ queryKey: ["card", data.id] });
    const nextAssignees = desiredAssigned
      ? (() => {
          const optimisticAssignee = getOptimisticAssignee(memberId);

          return optimisticAssignee
            ? mergeCardAssignee(currentAssignees, optimisticAssignee)
            : currentAssignees;
        })()
      : removeCardAssignee(currentAssignees, memberId);

    patchAssignees(nextAssignees);

    if (activeRequest) {
      activeRequest.queuedAssigned = desiredAssigned;
    } else {
      sendMemberMutation(memberId, desiredAssigned, currentAssignees);
    }
  };

  return {
    isLoadingUpdate,
    isLoadingAssign: assignPendingCount > 0,
    isLoadingUnassign: unassignPendingCount > 0,
    updateDateRange,
    updateDueDate,
    updateStartDate,
    onDateSubmit,
    updateCompletion,
    handleMemberToggle,
  };
};
