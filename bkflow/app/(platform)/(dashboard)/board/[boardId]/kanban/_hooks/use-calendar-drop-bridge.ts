"use client";

import { useCallback, useEffect, useRef } from "react";

import { getDayViewSlotFromPointer } from "@/lib/calendar/calendar-day-view";

import {
  CALENDAR_DAY_DRAG_CLASSES,
  CalendarDragPoint,
  CalendarDropTarget,
  getCalendarDropTargetFromPoint,
} from "../_lib/calendar-drop-bridge";

type UseCalendarDropBridgeOptions = {
  enableCalendarDragHandle: boolean;
};

export const useCalendarDropBridge = ({
  enableCalendarDragHandle,
}: UseCalendarDropBridgeOptions) => {
  const lastDragPointRef = useRef<CalendarDragPoint | null>(null);
  const lockedCalendarDropTargetRef = useRef<CalendarDropTarget | null | undefined>(undefined);
  const activeCalendarDragCardIdRef = useRef<string | null>(null);
  const highlightedCalendarDayRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!enableCalendarDragHandle) {
      return;
    }

    const clearHighlightedCalendarDay = () => {
      if (highlightedCalendarDayRef.current) {
        highlightedCalendarDayRef.current.classList.remove(
          ...CALENDAR_DAY_DRAG_CLASSES,
        );
        delete highlightedCalendarDayRef.current.dataset.calendarDragOverSlot;
        highlightedCalendarDayRef.current.style.removeProperty(
          "--drag-over-slot-index",
        );
      }
      highlightedCalendarDayRef.current = null;
    };

    const updateHighlightedCalendarDay = (x: number, y: number) => {
      if (!activeCalendarDragCardIdRef.current) {
        clearHighlightedCalendarDay();
        return;
      }

      const dayElement = document
        .elementsFromPoint(x, y)
        .map((element) => element.closest<HTMLElement>("[data-calendar-day-key]"))
        .find(Boolean) ?? null;

      const isDayViewGrid = dayElement?.dataset.calendarDayViewGrid === "true";

      if (highlightedCalendarDayRef.current === dayElement) {
        if (dayElement && isDayViewGrid) {
          const slotIndex = getDayViewSlotFromPointer({ clientY: y }, dayElement);
          dayElement.dataset.calendarDragOverSlot = "true";
          dayElement.style.setProperty("--drag-over-slot-index", String(slotIndex));
        }
        return;
      }

      clearHighlightedCalendarDay();

      if (dayElement) {
        dayElement.classList.add(...CALENDAR_DAY_DRAG_CLASSES);
        highlightedCalendarDayRef.current = dayElement;

        if (isDayViewGrid) {
          const slotIndex = getDayViewSlotFromPointer({ clientY: y }, dayElement);
          dayElement.dataset.calendarDragOverSlot = "true";
          dayElement.style.setProperty("--drag-over-slot-index", String(slotIndex));
        }
      }
    };

    const updateLastDragPoint = (event: MouseEvent | PointerEvent) => {
      if (lockedCalendarDropTargetRef.current !== undefined) {
        return;
      }

      lastDragPointRef.current = {
        x: event.clientX,
        y: event.clientY,
      };
      updateHighlightedCalendarDay(event.clientX, event.clientY);
    };

    const lockCalendarDropTarget = (event: MouseEvent | PointerEvent) => {
      if (!activeCalendarDragCardIdRef.current) {
        return;
      }

      const point = {
        x: event.clientX,
        y: event.clientY,
      };

      lastDragPointRef.current = point;
      lockedCalendarDropTargetRef.current = getCalendarDropTargetFromPoint(point);
      updateHighlightedCalendarDay(event.clientX, event.clientY);
    };

    window.addEventListener("pointermove", updateLastDragPoint, true);
    window.addEventListener("mousemove", updateLastDragPoint, true);
    window.addEventListener("pointerup", lockCalendarDropTarget, true);
    window.addEventListener("mouseup", lockCalendarDropTarget, true);

    return () => {
      window.removeEventListener("pointermove", updateLastDragPoint, true);
      window.removeEventListener("mousemove", updateLastDragPoint, true);
      window.removeEventListener("pointerup", lockCalendarDropTarget, true);
      window.removeEventListener("mouseup", lockCalendarDropTarget, true);
      clearHighlightedCalendarDay();
    };
  }, [enableCalendarDragHandle]);

  const getCalendarDropDateUnderLastDragPoint = useCallback(() => {
    if (lockedCalendarDropTargetRef.current !== undefined) {
      return lockedCalendarDropTargetRef.current;
    }

    const point = lastDragPointRef.current;

    if (!point) {
      return null;
    }

    return getCalendarDropTargetFromPoint(point);
  }, []);

  const clearCalendarDropHighlight = useCallback(() => {
    if (highlightedCalendarDayRef.current) {
      highlightedCalendarDayRef.current.classList.remove(
        ...CALENDAR_DAY_DRAG_CLASSES,
      );
      delete highlightedCalendarDayRef.current.dataset.calendarDragOverSlot;
      highlightedCalendarDayRef.current.style.removeProperty(
        "--drag-over-slot-index",
      );
    }
    highlightedCalendarDayRef.current = null;
    activeCalendarDragCardIdRef.current = null;
    lockedCalendarDropTargetRef.current = undefined;
  }, []);

  const beginCalendarDrag = useCallback((cardId: string) => {
    if (enableCalendarDragHandle) {
      activeCalendarDragCardIdRef.current = cardId;
      lockedCalendarDropTargetRef.current = undefined;
    }
  }, [enableCalendarDragHandle]);

  return {
    beginCalendarDrag,
    getCalendarDropDateUnderLastDragPoint,
    clearCalendarDropHighlight,
  };
};
