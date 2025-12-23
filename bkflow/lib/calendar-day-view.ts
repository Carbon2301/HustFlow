const GMT7_OFFSET_MINUTES = 7 * 60;
const GMT7_OFFSET_MS = GMT7_OFFSET_MINUTES * 60 * 1000;
const DAY_VIEW_SLOT_MINUTES = 15;
export const DAY_VIEW_SLOT_COUNT = 96;
export const DAY_VIEW_SLOT_HEIGHT = 20;

type PointerLike = {
  clientY: number;
};

const clampDayViewSlotIndex = (slotIndex: number) =>
  Math.min(Math.max(slotIndex, 0), DAY_VIEW_SLOT_COUNT - 1);

const getGmt7Parts = (date: Date) => {
  const shiftedDate = new Date(date.getTime() + GMT7_OFFSET_MS);

  return {
    year: shiftedDate.getUTCFullYear(),
    month: shiftedDate.getUTCMonth(),
    date: shiftedDate.getUTCDate(),
  };
};

export const getDayViewSlotFromPointer = (
  event: PointerLike,
  gridElement: HTMLElement,
) => {
  const rect = gridElement.getBoundingClientRect();
  const rawSlotIndex = Math.round(
    (event.clientY - rect.top) / DAY_VIEW_SLOT_HEIGHT,
  );

  return clampDayViewSlotIndex(rawSlotIndex);
};

export const getDayViewDropDate = (anchorDate: Date, slotIndex: number) => {
  const { year, month, date } = getGmt7Parts(anchorDate);
  const clampedSlotIndex = clampDayViewSlotIndex(slotIndex);
  const totalMinutes = clampedSlotIndex * DAY_VIEW_SLOT_MINUTES;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return new Date(
    Date.UTC(year, month, date, hours, minutes, 0, 0) - GMT7_OFFSET_MS,
  );
};
