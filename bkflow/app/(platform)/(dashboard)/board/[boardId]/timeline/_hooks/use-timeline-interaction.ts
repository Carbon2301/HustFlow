"use client";

import {
  type PointerEvent,
  type RefObject,
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { isAfter } from "date-fns";
import { toast } from "sonner";

import { getDateTimezoneOffset } from "@/lib/date-utils";

import type {
  ScheduledCard,
  TimelineDateOverride,
  TimelineInteraction,
  TimelineInteractionMode,
  TimelineSingleDateField,
  TimelineZoom,
} from "../_types";
import {
  getInteractionDateOverride,
  getInteractionDateRange,
  hasSameDateRange,
  parseCardDateTime,
} from "../_lib/date-utils";

type ExecuteUpdateCard = (input: {
  id: string;
  boardId: string;
  startDate?: Date;
  dueDate?: Date;
  dueDateTimezoneOffset?: number;
}) => void;

type UseTimelineInteractionInput = {
  boardId: string;
  zoom: TimelineZoom;
  canEditTimeline: boolean;
  updatingCardId: string | null;
  setUpdatingCardId: Dispatch<SetStateAction<string | null>>;
  setDateOverrides: Dispatch<SetStateAction<Record<string, TimelineDateOverride>>>;
  removeDateOverride: (cardId: string) => void;
  executeUpdateCard: ExecuteUpdateCard;
  pendingUpdateCardIdRef: RefObject<string | null>;
};

export const useTimelineInteraction = ({
  boardId,
  zoom,
  canEditTimeline,
  updatingCardId,
  setUpdatingCardId,
  setDateOverrides,
  removeDateOverride,
  executeUpdateCard,
  pendingUpdateCardIdRef,
}: UseTimelineInteractionInput) => {
  const [interaction, setInteraction] = useState<TimelineInteraction | null>(null);
  const interactionRef = useRef<TimelineInteraction | null>(null);
  const suppressOpenCardIdRef = useRef<string | null>(null);
  const setActiveInteraction = useCallback((nextInteraction: TimelineInteraction | null) => {
    interactionRef.current = nextInteraction;
    setInteraction(nextInteraction);
  }, []);
  const shouldSuppressCardOpen = useCallback((cardId: string) => {
    if (suppressOpenCardIdRef.current === cardId) {
      suppressOpenCardIdRef.current = null;
      return true;
    }

    return false;
  }, []);
  const handleBarPointerDown = useCallback((
    event: PointerEvent<HTMLElement>,
    row: ScheduledCard,
    mode: TimelineInteractionMode,
    columnWidth: number,
  ) => {
    if (!canEditTimeline) {
      toast.error("Bạn cần quyền chỉnh sửa để cập nhật timeline.");
      return;
    }

    if (updatingCardId) {
      return;
    }

    if (row.hasInvalidRange) {
      toast.error("Khoảng ngày chưa hợp lệ. Hãy sửa trong thẻ trước khi kéo.");
      return;
    }

    const originalStartDate = parseCardDateTime(row.card.startDate);
    const originalDueDate = parseCardDateTime(row.card.dueDate);

    if (mode === "move-milestone") {
      const singleDateField: TimelineSingleDateField | null = originalStartDate && !originalDueDate
        ? "startDate"
        : !originalStartDate && originalDueDate
          ? "dueDate"
          : null;
      const originalSingleDate = singleDateField === "startDate"
        ? originalStartDate
        : originalDueDate;

      if (!singleDateField || !originalSingleDate) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.setPointerCapture?.(event.pointerId);
      setActiveInteraction({
        mode,
        cardId: row.card.id,
        pointerId: event.pointerId,
        pointerStartX: event.clientX,
        columnWidth,
        originalStartDate: originalStartDate ?? originalSingleDate,
        originalDueDate: originalDueDate ?? originalSingleDate,
        originalSingleDate,
        singleDateField,
        deltaUnits: 0,
        hasMoved: false,
      });
      return;
    }

    if (!originalStartDate || !originalDueDate || row.isMilestone) {
      return;
    }

    if (mode !== "move") {
      suppressOpenCardIdRef.current = row.card.id;
    }

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setActiveInteraction({
      mode,
      cardId: row.card.id,
      pointerId: event.pointerId,
      pointerStartX: event.clientX,
      columnWidth,
      originalStartDate,
      originalDueDate,
      deltaUnits: 0,
      hasMoved: false,
    });
  }, [canEditTimeline, setActiveInteraction, updatingCardId]);

  useEffect(() => {
    if (!interaction) {
      return undefined;
    }

    const handlePointerMove = (event: globalThis.PointerEvent) => {
      const currentInteraction = interactionRef.current;

      if (!currentInteraction || event.pointerId !== currentInteraction.pointerId) {
        return;
      }

      const nextDeltaUnits = Math.round(
        (event.clientX - currentInteraction.pointerStartX) / currentInteraction.columnWidth,
      );

      if (nextDeltaUnits === currentInteraction.deltaUnits) {
        return;
      }

      const nextInteraction = {
        ...currentInteraction,
        deltaUnits: nextDeltaUnits,
        hasMoved: currentInteraction.hasMoved || nextDeltaUnits !== 0,
      };
      const nextOverride = getInteractionDateOverride(nextInteraction, zoom);

      suppressOpenCardIdRef.current = currentInteraction.cardId;
      setActiveInteraction(nextInteraction);
      setDateOverrides((current) => ({
        ...current,
        [currentInteraction.cardId]: nextOverride,
      }));
    };

    const handlePointerEnd = (event: globalThis.PointerEvent) => {
      const currentInteraction = interactionRef.current;

      if (!currentInteraction || event.pointerId !== currentInteraction.pointerId) {
        return;
      }

      if (!currentInteraction.hasMoved) {
        setActiveInteraction(null);
        return;
      }

      const nextRange = getInteractionDateRange(currentInteraction, zoom);

      if (
        currentInteraction.mode !== "move-milestone" &&
        isAfter(nextRange.startDate, nextRange.dueDate)
      ) {
        removeDateOverride(currentInteraction.cardId);
        setActiveInteraction(null);
        toast.error("Ngày bắt đầu phải trước hoặc bằng ngày hết hạn.");
        return;
      }

      const hasNoDateChange = currentInteraction.mode === "move-milestone"
        ? (
          currentInteraction.originalSingleDate?.getTime() ===
            (
              currentInteraction.singleDateField === "startDate"
                ? nextRange.startDate
                : nextRange.dueDate
            ).getTime()
        )
        : hasSameDateRange(
          nextRange.startDate,
          nextRange.dueDate,
          currentInteraction.originalStartDate,
          currentInteraction.originalDueDate,
        );

      if (hasNoDateChange) {
        removeDateOverride(currentInteraction.cardId);
        setActiveInteraction(null);
        return;
      }

      pendingUpdateCardIdRef.current = currentInteraction.cardId;
      setUpdatingCardId(currentInteraction.cardId);
      setActiveInteraction(null);
      if (currentInteraction.mode === "move-milestone") {
        const nextSingleDate = currentInteraction.singleDateField === "startDate"
          ? nextRange.startDate
          : nextRange.dueDate;

        executeUpdateCard({
          id: currentInteraction.cardId,
          boardId,
          ...(currentInteraction.singleDateField === "startDate"
            ? { startDate: nextSingleDate }
            : { dueDate: nextSingleDate }),
          dueDateTimezoneOffset: getDateTimezoneOffset(nextSingleDate),
        });
        return;
      }

      executeUpdateCard({
        id: currentInteraction.cardId,
        boardId,
        startDate: nextRange.startDate,
        dueDate: nextRange.dueDate,
        dueDateTimezoneOffset: getDateTimezoneOffset(nextRange.dueDate),
      });
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerEnd);
    window.addEventListener("pointercancel", handlePointerEnd);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerEnd);
      window.removeEventListener("pointercancel", handlePointerEnd);
    };
  }, [
    boardId,
    executeUpdateCard,
    interaction,
    pendingUpdateCardIdRef,
    removeDateOverride,
    setActiveInteraction,
    setDateOverrides,
    setUpdatingCardId,
    zoom,
  ]);

  return {
    interaction,
    interactionRef,
    setActiveInteraction,
    handleBarPointerDown,
    shouldSuppressCardOpen,
  };
};
