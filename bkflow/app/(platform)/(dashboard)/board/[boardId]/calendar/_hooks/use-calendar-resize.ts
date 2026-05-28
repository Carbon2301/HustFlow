"use client";

import { useState, type PointerEvent } from "react";
import { toast } from "sonner";

import type { InputType as UpdateCardInput } from "@/actions/cards/update-card/types";
import { getDateTimezoneOffset } from "@/lib/date-utils";
import { DAY_VIEW_SLOT_HEIGHT } from "@/lib/calendar/calendar-day-view";

import { GMT7_OFFSET_MINUTES, MINUTES_IN_DAY } from "../_lib/constants";
import {
  getDateWithPreservedTime,
  getDayKey,
  getGmt7DayBoundary,
  getGmt7DayKey,
  getReminderError,
  parseCalendarDate,
  roundDayViewEndMinute,
  roundDayViewStartMinute,
} from "../_lib/date-utils";
import { isCalendarCardItem } from "../_lib/item-utils";
import type {
  CalendarRange,
  CalendarResizeEdge,
  CalendarResizeState,
  DayViewCreateSelectionState,
  DayViewResizeState,
  PositionedDayViewBlock,
} from "../_types";

type BooleanRef = {
  current: boolean;
};

type UseCalendarResizeOptions = {
  boardId: string;
  anchorDate: Date;
  daysByKey: Record<string, Date>;
  executeUpdateCard: (input: UpdateCardInput) => void;
  setUpdateSuccessToast: (message: string | null) => void;
  isUpdatingCardDate: boolean;
  isUpdatingChecklistItemDueDate: boolean;
  invalidateBoardCalendar: () => void;
  refetchCalendar: () => void;
  suppressClickRef: BooleanRef;
  setExpandedDayKey: (dayKey: string | null) => void;
  setDayViewCreateSelection: (
    selection: DayViewCreateSelectionState | null,
  ) => void;
  setDragOverDayKey: (dayKey: string | null) => void;
  setDragOverDaySlotIndex: (slotIndex: number | null) => void;
  setDragOverDayMinute: (minute: number | null) => void;
};

export const useCalendarResize = ({
  boardId,
  anchorDate,
  daysByKey,
  executeUpdateCard,
  setUpdateSuccessToast,
  isUpdatingCardDate,
  isUpdatingChecklistItemDueDate,
  invalidateBoardCalendar,
  refetchCalendar,
  suppressClickRef,
  setExpandedDayKey,
  setDayViewCreateSelection,
  setDragOverDayKey,
  setDragOverDaySlotIndex,
  setDragOverDayMinute,
}: UseCalendarResizeOptions) => {
  const [resizingRange, setResizingRange] = useState<CalendarResizeState | null>(null);
  const [resizingDayViewBlock, setResizingDayViewBlock] =
    useState<DayViewResizeState | null>(null);

  const resetDayViewBlockResize = () => {
    setResizingDayViewBlock(null);
    setDayViewCreateSelection(null);
    setDragOverDayKey(null);
    setDragOverDaySlotIndex(null);
    setDragOverDayMinute(null);
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);
  };

  const getDayViewResizeMinute = (
    event: PointerEvent<HTMLElement>,
    handleElement: HTMLElement,
  ) => {
    const gridElement = handleElement.closest<HTMLElement>("[data-calendar-day-view-grid]");

    if (!gridElement) {
      return null;
    }

    const rect = gridElement.getBoundingClientRect();
    const rawMinute =
      ((event.clientY - rect.top) / DAY_VIEW_SLOT_HEIGHT) * 15;

    return Math.min(
      Math.max(Math.round(rawMinute), 0),
      MINUTES_IN_DAY,
    );
  };

  const getDayViewDateAtMinute = (minute: number) => {
    const { start } = getGmt7DayBoundary(anchorDate);

    return new Date(start.getTime() + minute * 60_000);
  };

  const handleDayViewBlockResizeStart = (
    event: PointerEvent<HTMLSpanElement>,
    block: PositionedDayViewBlock,
    edge: CalendarResizeEdge,
  ) => {
    const canResize =
      block.item.type === "card" &&
      !!block.item.startDate &&
      !!block.item.dueDate &&
      !isUpdatingCardDate &&
      !isUpdatingChecklistItemDueDate;

    if (!canResize || event.pointerType === "touch") {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    const targetMinute = getDayViewResizeMinute(event, event.currentTarget);

    if (targetMinute === null) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    suppressClickRef.current = true;
    setExpandedDayKey(null);
    setDragOverDayKey(getGmt7DayKey(anchorDate));
    setDragOverDaySlotIndex(null);
    setDragOverDayMinute(targetMinute);
    setResizingDayViewBlock({
      edge,
      pointerId: event.pointerId,
      block,
      targetMinute,
    });
  };

  const handleDayViewBlockResizeMove = (
    event: PointerEvent<HTMLSpanElement>,
  ) => {
    if (
      !resizingDayViewBlock ||
      resizingDayViewBlock.pointerId !== event.pointerId
    ) {
      return;
    }

    const targetMinute = getDayViewResizeMinute(event, event.currentTarget);

    if (targetMinute === null) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    setDragOverDayKey(getGmt7DayKey(anchorDate));
    setDragOverDaySlotIndex(null);
    setDragOverDayMinute(targetMinute);
    setResizingDayViewBlock((value) => value
      ? {
        ...value,
        targetMinute,
      }
      : value);
  };

  const failDayViewBlockResize = (message: string) => {
    toast.error(message);
    invalidateBoardCalendar();
    refetchCalendar();
    resetDayViewBlockResize();
  };

  const commitDayViewBlockResize = (
    block: PositionedDayViewBlock,
    edge: CalendarResizeEdge,
    targetMinute: number,
  ) => {
    if (!isCalendarCardItem(block.item)) {
      failDayViewBlockResize("Checklist item chưa hỗ trợ resize trong Day View.");
      return;
    }

    const currentStartDate = parseCalendarDate(block.item.startDate);
    const currentDueDate = parseCalendarDate(block.item.dueDate);

    if (!currentStartDate || !currentDueDate) {
      failDayViewBlockResize("Chỉ thẻ có cả ngày bắt đầu và hết hạn mới resize được.");
      return;
    }

    if (edge === "start") {
      const roundedTargetMinute = roundDayViewStartMinute(targetMinute);
      const targetDate = getDayViewDateAtMinute(roundedTargetMinute);

      if (targetDate.getTime() === currentStartDate.getTime()) {
        resetDayViewBlockResize();
        return;
      }

      const nextDurationMs = currentDueDate.getTime() - targetDate.getTime();

      if (targetDate.getTime() >= currentDueDate.getTime() || nextDurationMs < 15 * 60_000) {
        failDayViewBlockResize("Khoảng thời gian tối thiểu là 15 phút.");
        return;
      }

      setUpdateSuccessToast("Đã resize thẻ");
      executeUpdateCard({
        id: block.item.cardId,
        boardId,
        startDate: targetDate,
        dueDateTimezoneOffset: -GMT7_OFFSET_MINUTES,
      });
      return;
    }

    const roundedTargetMinute = roundDayViewEndMinute(targetMinute);
    const targetDate = getDayViewDateAtMinute(roundedTargetMinute);

    if (targetDate.getTime() === currentDueDate.getTime()) {
      resetDayViewBlockResize();
      return;
    }

    const nextDurationMs = targetDate.getTime() - currentStartDate.getTime();

    if (targetDate.getTime() <= currentStartDate.getTime() || nextDurationMs < 15 * 60_000) {
      failDayViewBlockResize("Khoảng thời gian tối thiểu là 15 phút.");
      return;
    }

    const reminderError = getReminderError(targetDate, block.item.reminder);

    if (reminderError) {
      failDayViewBlockResize(reminderError);
      return;
    }

    setUpdateSuccessToast("Đã resize thẻ");
    executeUpdateCard({
      id: block.item.cardId,
      boardId,
      dueDate: targetDate,
      dueDateTimezoneOffset: -GMT7_OFFSET_MINUTES,
      isCompleted: block.item.isCompleted,
      ...(block.item.reminder !== null ? { reminder: block.item.reminder } : {}),
    });
  };

  const handleDayViewBlockResizeEnd = (
    event: PointerEvent<HTMLSpanElement>,
  ) => {
    if (
      !resizingDayViewBlock ||
      resizingDayViewBlock.pointerId !== event.pointerId
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    commitDayViewBlockResize(
      resizingDayViewBlock.block,
      resizingDayViewBlock.edge,
      resizingDayViewBlock.targetMinute,
    );
  };

  const getResizeTargetDayKey = (event: PointerEvent<HTMLElement>) => {
    const element = document.elementFromPoint(event.clientX, event.clientY);
    const dayElement = element?.closest<HTMLElement>("[data-calendar-day-key]");

    return dayElement?.dataset.calendarDayKey ?? null;
  };

  const resetRangeResize = () => {
    setResizingRange(null);
    setDragOverDayKey(null);
    setDragOverDaySlotIndex(null);
    setDragOverDayMinute(null);
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);
  };

  const handleRangeResizeStart = (
    event: PointerEvent<HTMLButtonElement>,
    range: CalendarRange,
    edge: CalendarResizeEdge,
  ) => {
    if (isUpdatingCardDate || event.pointerType === "touch") {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    suppressClickRef.current = true;
    setExpandedDayKey(null);
    const targetDayKey = edge === "start" ? range.startKey : range.endKey;
    setDragOverDayKey(targetDayKey);
    setResizingRange({
      edge,
      pointerId: event.pointerId,
      range,
      targetDayKey,
    });
  };

  const handleRangeResizeMove = (event: PointerEvent<HTMLButtonElement>) => {
    if (!resizingRange || resizingRange.pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const targetDayKey = getResizeTargetDayKey(event);

    if (!targetDayKey || !daysByKey[targetDayKey]) {
      return;
    }

    setDragOverDayKey(targetDayKey);
    setResizingRange((value) => value
      ? {
        ...value,
        targetDayKey,
      }
      : value);
  };

  const commitRangeResize = (
    range: CalendarRange,
    edge: CalendarResizeEdge,
    targetDay: Date,
  ) => {
    const startDate = parseCalendarDate(range.item.startDate);
    const dueDate = parseCalendarDate(range.item.dueDate);

    if (!startDate || !dueDate) {
      toast.error("Không tìm thấy khoảng thời gian của thẻ.");
      resetRangeResize();
      return;
    }

    if (edge === "start") {
      const nextStartDate = getDateWithPreservedTime(startDate, targetDay);

      if (nextStartDate.getTime() > dueDate.getTime()) {
        toast.error("Ngày bắt đầu phải trước hoặc bằng ngày hết hạn.");
        resetRangeResize();
        return;
      }

      if (getDayKey(nextStartDate) === getDayKey(startDate)) {
        resetRangeResize();
        return;
      }

      setUpdateSuccessToast("Đã cập nhật khoảng thời gian");
      executeUpdateCard({
        id: range.item.cardId,
        boardId,
        startDate: nextStartDate,
        dueDateTimezoneOffset: getDateTimezoneOffset(nextStartDate),
      });
      return;
    }

    const nextDueDate = getDateWithPreservedTime(dueDate, targetDay);

    if (nextDueDate.getTime() < startDate.getTime()) {
      toast.error("Ngày hết hạn phải sau hoặc bằng ngày bắt đầu.");
      resetRangeResize();
      return;
    }

    if (getDayKey(nextDueDate) === getDayKey(dueDate)) {
      resetRangeResize();
      return;
    }

    const reminderError = getReminderError(nextDueDate, range.item.reminder);

    if (reminderError) {
      toast.error(reminderError);
      invalidateBoardCalendar();
      resetRangeResize();
      return;
    }

    setUpdateSuccessToast("Đã cập nhật khoảng thời gian");
    executeUpdateCard({
      id: range.item.cardId,
      boardId,
      dueDate: nextDueDate,
      dueDateTimezoneOffset: getDateTimezoneOffset(nextDueDate),
      isCompleted: range.item.isCompleted,
      ...(range.item.reminder !== null ? { reminder: range.item.reminder } : {}),
    });
  };

  const handleRangeResizeEnd = (event: PointerEvent<HTMLButtonElement>) => {
    if (!resizingRange || resizingRange.pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    const targetDayKey = getResizeTargetDayKey(event) ?? resizingRange.targetDayKey;
    const targetDay = daysByKey[targetDayKey];

    if (!targetDay) {
      resetRangeResize();
      return;
    }

    commitRangeResize(resizingRange.range, resizingRange.edge, targetDay);
  };

  return {
    resizingRange,
    resizingDayViewBlock,
    resetRangeResize,
    resetDayViewBlockResize,
    handleDayViewBlockResizeStart,
    handleDayViewBlockResizeMove,
    handleDayViewBlockResizeEnd,
    handleRangeResizeStart,
    handleRangeResizeMove,
    handleRangeResizeEnd,
  };
};
