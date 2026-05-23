import {
  getDayViewDropDate,
  getDayViewSlotFromPointer,
} from "@/lib/calendar/calendar-day-view";

export const getDefaultCalendarDueDate = (day: Date) =>
  new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    9,
    0,
    0,
    0,
  );

export const CALENDAR_DAY_DRAG_CLASSES = [
  "bg-violet-50",
  "ring-2",
  "ring-inset",
  "ring-violet-400",
];

export const getGmt7AnchorDateFromDayKey = (dayKey: string) => {
  const [year, month, day] = dayKey.split("-").map(Number);

  if (!year || !month || !day) {
    return null;
  }

  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0) - 7 * 60 * 60 * 1000);
};

export type CalendarDragPoint = {
  x: number;
  y: number;
};

export type CalendarDropTarget = {
  date: Date;
  isDayViewSlot: boolean;
};

export const getCalendarDropTargetFromPoint = (
  point: CalendarDragPoint,
): CalendarDropTarget | null => {
  const elements = document.elementsFromPoint(point.x, point.y);
  const dayViewGridElement = elements
    .map((element) => element.closest<HTMLElement>("[data-calendar-day-view-grid]"))
    .find(Boolean);
  const dayViewDayKey = dayViewGridElement?.dataset.calendarDayKey;

  if (dayViewGridElement && dayViewDayKey) {
    const anchorDate = getGmt7AnchorDateFromDayKey(dayViewDayKey);

    if (anchorDate) {
      const slotIndex = getDayViewSlotFromPointer(
        { clientY: point.y },
        dayViewGridElement,
      );

      return {
        date: getDayViewDropDate(anchorDate, slotIndex),
        isDayViewSlot: true,
      };
    }
  }

  const dayElement = elements
    .map((element) => element.closest<HTMLElement>("[data-calendar-day-key]"))
    .find(Boolean);
  const dayKey = dayElement?.dataset.calendarDayKey;

  if (!dayKey) {
    return null;
  }

  const [year, month, day] = dayKey.split("-").map(Number);

  if (!year || !month || !day) {
    return null;
  }

  return {
    date: new Date(year, month - 1, day),
    isDayViewSlot: false,
  };
};
