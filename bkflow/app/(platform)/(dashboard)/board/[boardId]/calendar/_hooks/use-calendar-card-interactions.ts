"use client";

import { useCallback, type MouseEvent } from "react";

import type { InputType as UpdateCardInput } from "@/actions/cards/update-card/types";

import { isCalendarCardItem } from "../_components/board-calendar/item-utils";
import type { CalendarOccurrence } from "../_components/board-calendar/types";

type BooleanRef = {
  current: boolean;
};

type CalendarCardModal = {
  onOpen: (id: string, options?: { checklistItemId?: string }) => void;
};

type UseCalendarCardInteractionsOptions = {
  boardId: string;
  cardModal: CalendarCardModal;
  suppressClickRef: BooleanRef;
  setExpandedDayKey: (dayKey: string | null) => void;
  executeUpdateCard: (input: UpdateCardInput) => void;
  setUpdateSuccessToast: (message: string | null) => void;
};

export const useCalendarCardInteractions = ({
  boardId,
  cardModal,
  suppressClickRef,
  setExpandedDayKey,
  executeUpdateCard,
  setUpdateSuccessToast,
}: UseCalendarCardInteractionsOptions) => {
  const openCalendarCard = useCallback((
    cardId: string,
    event?: MouseEvent<HTMLElement>,
    options?: { checklistItemId?: string },
  ) => {
    event?.stopPropagation();
    if (suppressClickRef.current) {
      return;
    }

    setExpandedDayKey(null);
    cardModal.onOpen(cardId, options);
  }, [cardModal, setExpandedDayKey, suppressClickRef]);

  const openCalendarCardDirect = useCallback((
    cardId: string,
    options?: { checklistItemId?: string },
  ) => {
    cardModal.onOpen(cardId, options);
  }, [cardModal]);

  const canClearStartDate = (occurrence: CalendarOccurrence) => (
    isCalendarCardItem(occurrence.item) &&
    (
      occurrence.kind === "start" ||
      occurrence.kind === "range" ||
      (occurrence.kind === "single" && !!occurrence.item.startDate)
    )
  );

  const canClearDueDate = (occurrence: CalendarOccurrence) => (
    isCalendarCardItem(occurrence.item) &&
    (
      occurrence.kind === "due" ||
      occurrence.kind === "range" ||
      (occurrence.kind === "single" && !!occurrence.item.dueDate)
    )
  );

  const toggleCalendarCardComplete = (occurrence: CalendarOccurrence) => {
    if (!isCalendarCardItem(occurrence.item)) {
      return;
    }

    setUpdateSuccessToast(occurrence.item.isCompleted
      ? "Đã bỏ hoàn thành"
      : "Đã đánh dấu hoàn thành");

    executeUpdateCard({
      id: occurrence.item.cardId,
      boardId,
      isCompleted: !occurrence.item.isCompleted,
    });
  };

  const clearCalendarStartDate = (occurrence: CalendarOccurrence) => {
    if (!isCalendarCardItem(occurrence.item)) {
      return;
    }

    setUpdateSuccessToast("Đã xóa ngày bắt đầu");

    executeUpdateCard({
      id: occurrence.item.cardId,
      boardId,
      startDate: null,
    });
  };

  const clearCalendarDueDate = (occurrence: CalendarOccurrence) => {
    if (!isCalendarCardItem(occurrence.item)) {
      return;
    }

    setUpdateSuccessToast("Đã xóa ngày hết hạn");

    executeUpdateCard({
      id: occurrence.item.cardId,
      boardId,
      dueDate: null,
      reminder: null,
      isCompleted: false,
    });
  };

  const handleQuickActionClick = (
    event: MouseEvent<HTMLButtonElement>,
    action: () => void,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    suppressClickRef.current = true;
    action();
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);
  };

  const handleUnscheduledCardClick = (cardId: string) => {
    if (suppressClickRef.current) {
      return;
    }

    cardModal.onOpen(cardId);
  };

  return {
    openCalendarCard,
    openCalendarCardDirect,
    canClearStartDate,
    canClearDueDate,
    toggleCalendarCardComplete,
    clearCalendarStartDate,
    clearCalendarDueDate,
    handleQuickActionClick,
    handleUnscheduledCardClick,
  };
};
