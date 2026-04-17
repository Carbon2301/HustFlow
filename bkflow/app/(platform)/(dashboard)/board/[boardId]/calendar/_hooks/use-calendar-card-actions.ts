"use client";

import { useCallback, useRef } from "react";
import type { QueryClient, UseQueryResult } from "@tanstack/react-query";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { toast } from "sonner";

import { setChecklistItemDueDate } from "@/actions/set-checklist-item-due-date";
import type { InputType as SetChecklistItemDueDateInput } from "@/actions/set-checklist-item-due-date/types";
import { updateCard } from "@/actions/update-card";
import type { InputType as UpdateCardInput } from "@/actions/update-card/types";
import { useAction } from "@/hooks/use-action";
import type { BoardCalendarResponse } from "@/types";

type UseCalendarCardActionsOptions = {
  query: UseQueryResult<BoardCalendarResponse>;
  queryClient: QueryClient;
  router: AppRouterInstance;
  invalidateBoardCalendar: () => void;
  setExpandedDayKey: (dayKey: string | null) => void;
  onUpdateComplete: () => void;
  onChecklistComplete: () => void;
};

export const useCalendarCardActions = ({
  query,
  queryClient,
  router,
  invalidateBoardCalendar,
  setExpandedDayKey,
  onUpdateComplete,
  onChecklistComplete,
}: UseCalendarCardActionsOptions) => {
  const updateSuccessToastRef = useRef<string | null>(null);
  const updatingChecklistItemCardIdRef = useRef<string | null>(null);

  const { execute: executeUpdateCard, isLoading: isUpdatingCardDate } = useAction(updateCard, {
    onSuccess: (data) => {
      updateSuccessToastRef.current = null;
      setExpandedDayKey(null);
      invalidateBoardCalendar();
      queryClient.invalidateQueries({ queryKey: ["card", data.id] });
      queryClient.invalidateQueries({ queryKey: ["card-logs", data.id] });
      router.refresh();
    },
    onError: (error) => {
      updateSuccessToastRef.current = null;
      toast.error(error);
      invalidateBoardCalendar();
      void query.refetch();
    },
    onComplete: onUpdateComplete,
  });

  const {
    execute: executeSetChecklistItemDueDate,
    isLoading: isUpdatingChecklistItemDueDate,
  } = useAction(setChecklistItemDueDate, {
    onSuccess: () => {
      const cardId = updatingChecklistItemCardIdRef.current;

      setExpandedDayKey(null);
      invalidateBoardCalendar();

      if (cardId) {
        queryClient.invalidateQueries({ queryKey: ["card", cardId] });
        queryClient.invalidateQueries({ queryKey: ["card-logs", cardId] });
      }

      router.refresh();
    },
    onError: (error) => {
      toast.error(error);
      invalidateBoardCalendar();
    },
    onComplete: () => {
      updatingChecklistItemCardIdRef.current = null;
      onChecklistComplete();
    },
  });

  const setUpdateSuccessToast = useCallback((message: string | null) => {
    updateSuccessToastRef.current = message;
  }, []);

  const setUpdatingChecklistItemCardId = useCallback((cardId: string | null) => {
    updatingChecklistItemCardIdRef.current = cardId;
  }, []);

  return {
    executeUpdateCard: executeUpdateCard as (input: UpdateCardInput) => void,
    executeSetChecklistItemDueDate:
      executeSetChecklistItemDueDate as (input: SetChecklistItemDueDateInput) => void,
    isUpdatingCardDate,
    isUpdatingChecklistItemDueDate,
    setUpdateSuccessToast,
    setUpdatingChecklistItemCardId,
  };
};
