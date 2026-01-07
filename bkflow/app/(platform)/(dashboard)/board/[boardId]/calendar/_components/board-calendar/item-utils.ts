import { format, isSameDay } from "date-fns";

import type {
  BoardCalendarCardItem,
  BoardCalendarChecklistItem,
  BoardCalendarItem,
} from "@/types";

import {
  formatCalendarDateTime,
  formatCalendarTime,
  parseCalendarDate,
} from "./date-utils";
import type { CalendarOccurrence } from "./types";

export const parseDayViewItemDates = (item: BoardCalendarItem) => ({
  startDate: isCalendarCardItem(item) ? parseCalendarDate(item.startDate) : null,
  dueDate: parseCalendarDate(item.dueDate),
});

export const isCalendarCardItem = (
  item: BoardCalendarItem,
): item is BoardCalendarCardItem => item.type === "card";

export const isCalendarChecklistItem = (
  item: BoardCalendarItem,
): item is BoardCalendarChecklistItem => item.type === "checklist-item";

export const getCalendarItemStartDate = (item: BoardCalendarItem) =>
  isCalendarCardItem(item) ? item.startDate : null;

export const getCalendarItemDueDate = (item: BoardCalendarItem) => item.dueDate;

export const getCalendarItemAssigneeCount = (item: BoardCalendarItem) =>
  isCalendarCardItem(item)
    ? item.assignees.length
    : item.assignee
      ? 1
      : 0;

export const getCalendarItemCommentCount = (item: BoardCalendarItem) =>
  isCalendarCardItem(item) ? item.commentCount : 0;

export const getCalendarItemTitle = (item: BoardCalendarItem) => {
  const startDate = parseCalendarDate(getCalendarItemStartDate(item));
  const dueDate = parseCalendarDate(getCalendarItemDueDate(item));
  const parts = [
    item.title,
    `Danh sách: ${item.listTitle}`,
  ];

  if (item.type === "checklist-item") {
    parts.splice(1, 0, `Thẻ: ${item.cardTitle}`);
    parts.splice(2, 0, `Danh sách kiểm tra: ${item.checklistTitle}`);
  }

  if (startDate) {
    parts.push(`Bắt đầu: ${formatCalendarDateTime(startDate)}`);
  }

  if (dueDate) {
    parts.push(`Kết thúc: ${formatCalendarDateTime(dueDate)}`);
  }

  if (item.isCompleted) {
    parts.push("Trạng thái: Hoàn thành");
  }

  if (item.type === "checklist-item" && item.assignee) {
    parts.push(`Phụ trách: ${item.assignee.userName}`);
  }

  return parts.join("\n");
};

export const getOccurrenceTimeLabel = (occurrence: CalendarOccurrence) => {
  const startDate = parseCalendarDate(getCalendarItemStartDate(occurrence.item));
  const dueDate = parseCalendarDate(getCalendarItemDueDate(occurrence.item));

  if (startDate && dueDate && isSameDay(startDate, dueDate)) {
    const startTime = formatCalendarTime(startDate);
    const dueTime = formatCalendarTime(dueDate);

    return startTime === dueTime ? startTime : `${startTime}-${dueTime}`;
  }

  if (
    getCalendarItemStartDate(occurrence.item) &&
    !getCalendarItemDueDate(occurrence.item) &&
    startDate
  ) {
    return formatCalendarTime(startDate);
  }

  if (getCalendarItemDueDate(occurrence.item) && dueDate) {
    return formatCalendarTime(dueDate);
  }

  if (startDate) {
    return formatCalendarTime(startDate);
  }

  return null;
};

export const getOccurrenceLabel = (occurrence: CalendarOccurrence) => {
  if (occurrence.item.type === "checklist-item") {
    return null;
  }

  if (occurrence.kind === "start") {
    return "Bắt đầu";
  }

  if (occurrence.kind === "due") {
    return "Kết thúc";
  }

  if (occurrence.kind === "range") {
    const start = parseCalendarDate(occurrence.item.startDate);
    const due = parseCalendarDate(occurrence.item.dueDate);

    if (start && due) {
      return `${format(start, "dd/MM")} - ${format(due, "dd/MM")}`;
    }

    return null;
  }

  // Handles occurrence.kind === "single"
  const start = parseCalendarDate(occurrence.item.startDate);
  const due = parseCalendarDate(occurrence.item.dueDate);

  if (start && !due) {
    return "Bắt đầu";
  }

  if (!start && due) {
    return "Kết thúc";
  }

  if (start && due) {
    return null;
  }

  return "Lịch";
};

export const isOverdue = (item: BoardCalendarItem) => {
  const dueDate = getCalendarItemDueDate(item);

  if (!dueDate || item.isCompleted) {
    return false;
  }

  return new Date(dueDate).getTime() < Date.now();
};

export const getOccurrenceTone = (occurrence: CalendarOccurrence) => {
  if (occurrence.item.isCompleted) {
    return "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100";
  }

  if (isOverdue(occurrence.item) && occurrence.kind !== "start") {
    return "border-red-200 bg-red-50 text-red-800 hover:bg-red-100";
  }

  if (occurrence.item.type === "checklist-item") {
    return "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100";
  }

  if (occurrence.kind === "start") {
    return "border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100";
  }

  return "border-violet-200 bg-violet-50 text-violet-800 hover:bg-violet-100";
};
