import { format } from "date-fns";

const DATE_TIME_LOCAL_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

export const formatDateTimeLocalInput = (date?: Date | string | null) => {
  if (!date) {
    return "";
  }

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return "";
  }

  const timezoneOffset = parsedDate.getTimezoneOffset() * 60_000;

  return new Date(parsedDate.getTime() - timezoneOffset)
    .toISOString()
    .slice(0, 16);
};

export const parseDateTimeLocalInput = (value: string) => {
  const match = DATE_TIME_LOCAL_PATTERN.exec(value);

  if (!match) {
    return null;
  }

  const [, year, month, day, hours, minutes] = match;
  const parsedDate = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hours),
    Number(minutes),
  );

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return parsedDate;
};

export const getDateTimezoneOffset = (date: Date) => date.getTimezoneOffset();

export const isOverdue = (date: Date | string, now = new Date()) =>
  new Date(date).getTime() < now.getTime();

export const getStartOfTomorrow = (now = new Date()) => {
  const start = new Date(now);
  start.setDate(now.getDate() + 1);
  start.setHours(0, 0, 0, 0);

  return start;
};

export const getEndOfTomorrow = (now = new Date()) => {
  const end = getStartOfTomorrow(now);
  end.setHours(23, 59, 59, 999);

  return end;
};

export const formatDateTimeInOffset = (
  date: Date | string,
  formatStr: string,
  timezoneOffsetMinutes?: number,
) => {
  const parsedDate = new Date(date);

  if (
    timezoneOffsetMinutes === undefined ||
    Number.isNaN(timezoneOffsetMinutes)
  ) {
    return format(parsedDate, formatStr);
  }

  const shiftedDate = new Date(
    parsedDate.getTime() - timezoneOffsetMinutes * 60_000,
  );

  return format(shiftedDate, formatStr);
};
