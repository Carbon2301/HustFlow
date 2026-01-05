export const WEEK_DAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
export const DAY_VIEW_LABELS = ["Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy"];
export const GMT7_OFFSET_MINUTES = 7 * 60;
export const GMT7_OFFSET_MS = GMT7_OFFSET_MINUTES * 60 * 1000;
export const MINUTES_IN_DAY = 24 * 60;
export const MONTH_VISIBLE_DESKTOP = 3;
export const MONTH_VISIBLE_MOBILE = 2;
export const MONTH_RANGE_LANES = 2;
export const WEEK_RANGE_LANES = 4;
export const RANGE_LANE_HEIGHT = 28;
export const RANGE_LANE_GAP = 4;
export const WEEK_VISIBLE_DESKTOP = 8;
export const WEEK_VISIBLE_MOBILE = 4;
export const DAY_LANE_GAP_PX = 4;
export const MAX_DAY_LANES = 4;
export const MAX_MOBILE_DAY_LANES = 3;
export const DAY_FLOATING_CARD_BLOCK_MINUTES = 30;
export const MIN_CREATE_DURATION_MINUTES = 15;
export const MIN_CREATE_DURATION_MS = MIN_CREATE_DURATION_MINUTES * 60_000;
export const DAY_TIME_SLOTS = Array.from({ length: 96 }, (_, index) => {
  const totalMinutes = index * 15;
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;

  return {
    index,
    hour,
    minute,
    label: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
    isHour: minute === 0,
  };
});
export const DEFAULT_CREATE_HOUR = 9;
export const DEFAULT_CREATE_TIME = `${String(DEFAULT_CREATE_HOUR).padStart(2, "0")}:00`;
export const TIME_INPUT_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
