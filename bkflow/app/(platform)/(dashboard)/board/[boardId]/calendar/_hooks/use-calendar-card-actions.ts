"use client";

import { useCallback, useRef } from "react";
import type { QueryClient, UseQueryResult } from "@tanstack/react-query";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { toast } from "sonner";

import { setChecklistItemDueDate } from "@/actions/checklists/set-checklist-item-due-date";
import type { InputType as SetChecklistItemDueDateInput } from "@/actions/checklists/set-checklist-item-due-date/types";
import { updateCard } from "@/actions/cards/update-card";
import type { InputType as UpdateCardInput } from "@/actions/cards/update-card/types";
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
  const updateRollbackRef = useRef<BoardCalendarResponse | null>(null);

  const patchCalendarCard = useCallback((input: UpdateCardInput) => {
    updateRollbackRef.current = query.data ?? null;
    queryClient.setQueriesData<BoardCalendarResponse>(
      { queryKey: ["board-calendar", query.data?.boardId] },
      (current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          items: current.items.map((item) =>
            item.type === "card" && item.cardId === input.id
              ? {
                ...item,
                ...(input.startDate !== undefined ? { startDate: input.startDate?.toISOString() ?? null } : {}),
                ...(input.dueDate !== undefined ? { dueDate: input.dueDate?.toISOString() ?? null } : {}),
                ...(input.isCompleted !== undefined ? { isCompleted: input.isCompleted } : {}),
                ...(input.reminder !== undefined ? { reminder: input.reminder } : {}),
              }
              : item
          ),
          unscheduledCards: input.startDate !== undefined || input.dueDate !== undefined
            ? current.unscheduledCards.filter((card) => card.cardId !== input.id)
            : current.unscheduledCards.map((card) =>
              card.cardId === input.id && input.isCompleted !== undefined
                ? { ...card, isCompleted: input.isCompleted }
                : card
            ),
        };
      },
    );
  }, [query.data, queryClient]);

  const { execute: executeUpdateCard, isLoading: isUpdatingCardDate } = useAction(updateCard, {
    onSuccess: (data) => {
      updateSuccessToastRef.current = null;
      updateRollbackRef.current = null;
      setExpandedDayKey(null);
      invalidateBoardCalendar();
      queryClient.invalidateQueries({ queryKey: ["card", data.id] });
      queryClient.invalidateQueries({ queryKey: ["card-logs", data.id] });
    },
    onError: (error) => {
      updateSuccessToastRef.current = null;
      if (updateRollbackRef.current) {
        queryClient.setQueriesData(
          { queryKey: ["board-calendar", updateRollbackRef.current.boardId] },
          updateRollbackRef.current,
        );
        updateRollbackRef.current = null;
      }
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
    executeUpdateCard: ((input: UpdateCardInput) => {
      patchCalendarCard(input);
      executeUpdateCard(input);
    }) as (input: UpdateCardInput) => void,
    executeSetChecklistItemDueDate:
      executeSetChecklistItemDueDate as (input: SetChecklistItemDueDateInput) => void,
    isUpdatingCardDate,
    isUpdatingChecklistItemDueDate,
    setUpdateSuccessToast,
    setUpdatingChecklistItemCardId,
  };
};
