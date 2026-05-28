"use client";

import { useState, type PointerEvent } from "react";

import { DAY_VIEW_SLOT_HEIGHT } from "@/lib/calendar/calendar-day-view";

import { MINUTES_IN_DAY } from "../_lib/constants";
import {
  getCreateRangeFromDayViewMinutes,
  getRoundedCreateRangeFromDayViewMinutes,
} from "../_lib/date-utils";
import type { DayViewCreateSelectionState } from "../_types";

type BooleanRef = {
  current: boolean;
};

type UseCalendarDayViewCreateOptions = {
  anchorDate: Date;
  isInteractionBlocked: boolean;
  canCreate: boolean;
  suppressClickRef: BooleanRef;
  setExpandedDayKey: (dayKey: string | null) => void;
  setOpenDayOverflowGroupId: (groupId: string | null) => void;
  openCreateDialogWithRange: (startDate: Date, dueDate: Date) => void;
};

export const useCalendarDayViewCreate = ({
  anchorDate,
  isInteractionBlocked,
  canCreate,
  suppressClickRef,
  setExpandedDayKey,
  setOpenDayOverflowGroupId,
  openCreateDialogWithRange,
}: UseCalendarDayViewCreateOptions) => {
  const [dayViewCreateSelection, setDayViewCreateSelection] =
    useState<DayViewCreateSelectionState | null>(null);
  const dayViewCreatePreview = dayViewCreateSelection
    ? getCreateRangeFromDayViewMinutes(
      anchorDate,
      dayViewCreateSelection.anchorMinute,
      dayViewCreateSelection.currentMinute,
    )
    : null;

  const resetDayViewCreateSelection = () => {
    setDayViewCreateSelection(null);
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);
  };

  const isDesktopDayViewCreatePointer = (event: PointerEvent<HTMLDivElement>) =>
    event.pointerType !== "touch" &&
    window.matchMedia("(min-width: 768px)").matches;

  const isBlockedDayViewCreateTarget = (target: EventTarget | null) => {
    if (!(target instanceof Element)) {
      return true;
    }

    return !!target.closest(
      [
        "button",
        "a",
        "input",
        "select",
        "textarea",
        "[role='button']",
        "[data-calendar-day-view-block]",
        "[data-calendar-day-view-resize-handle]",
        "[data-calendar-day-view-overflow]",
        "[data-calendar-current-time-indicator]",
        "[data-rbd-draggable-id]",
        "[draggable='true']",
      ].join(","),
    );
  };

  const getDayViewMinuteFromPointer = (
    event: PointerEvent<HTMLDivElement>,
    gridElement: HTMLDivElement,
  ) => {
    const rect = gridElement.getBoundingClientRect();
    const rawMinute =
      ((event.clientY - rect.top) / DAY_VIEW_SLOT_HEIGHT) * 15;

    return Math.min(Math.max(Math.round(rawMinute), 0), MINUTES_IN_DAY);
  };

  const canStartDayViewCreateSelection = (
    event: PointerEvent<HTMLDivElement>,
  ) => (
    isDesktopDayViewCreatePointer(event) &&
    !isBlockedDayViewCreateTarget(event.target) &&
    !isInteractionBlocked &&
    !dayViewCreateSelection &&
    canCreate
  );

  const handleDayViewCreatePointerDown = (
    event: PointerEvent<HTMLDivElement>,
  ) => {
    if (!canStartDayViewCreateSelection(event)) {
      return;
    }

    const minute = getDayViewMinuteFromPointer(event, event.currentTarget);

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    suppressClickRef.current = true;
    setExpandedDayKey(null);
    setOpenDayOverflowGroupId(null);
    setDayViewCreateSelection({
      pointerId: event.pointerId,
      anchorMinute: minute,
      currentMinute: minute,
    });
  };

  const handleDayViewCreatePointerMove = (
    event: PointerEvent<HTMLDivElement>,
  ) => {
    if (
      !dayViewCreateSelection ||
      dayViewCreateSelection.pointerId !== event.pointerId
    ) {
      return;
    }

    const minute = getDayViewMinuteFromPointer(event, event.currentTarget);

    event.preventDefault();
    event.stopPropagation();
    setDayViewCreateSelection((value) => value
      ? {
        ...value,
        currentMinute: minute,
      }
      : value);
  };

  const handleDayViewCreatePointerEnd = (
    event: PointerEvent<HTMLDivElement>,
  ) => {
    if (
      !dayViewCreateSelection ||
      dayViewCreateSelection.pointerId !== event.pointerId
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    const range = getRoundedCreateRangeFromDayViewMinutes(
      anchorDate,
      dayViewCreateSelection.anchorMinute,
      dayViewCreateSelection.currentMinute,
    );

    setDayViewCreateSelection(null);
    openCreateDialogWithRange(range.startDate, range.dueDate);
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);
  };

  return {
    dayViewCreateSelection,
    setDayViewCreateSelection,
    dayViewCreatePreview,
    resetDayViewCreateSelection,
    handleDayViewCreatePointerDown,
    handleDayViewCreatePointerMove,
    handleDayViewCreatePointerEnd,
  };
};
