import { format, formatDistanceToNow, isPast } from "date-fns";
import { vi } from "date-fns/locale";

import { NotificationItem } from "@/components/notifications/types";
import { formatNotificationText } from "@/lib/utils";

const parseNotificationDate = (date: string | null) => {
  if (!date) {
    return null;
  }

  const parsed = new Date(date);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const formatNotificationDateTime = (date: string | null) => {
  const parsed = parseNotificationDate(date);

  return parsed ? format(parsed, "dd/MM/yyyy 'lúc' HH:mm", { locale: vi }) : null;
};

export const getReminderNotificationDisplay = (
  notification: NotificationItem,
) => {
  const formatted = formatNotificationText(notification.title, notification.message);
  const dueDate = parseNotificationDate(notification.dueDate);
  const cardTitle = notification.cardTitle?.trim() || null;

  if (!dueDate) {
    return {
      title: formatted.title,
      message: formatted.message,
      dueDateText: null,
      statusText: null,
      overdue: false,
    };
  }

  const overdue = isPast(dueDate);
  const timeText = format(dueDate, "HH:mm", { locale: vi });
  const relative = formatDistanceToNow(dueDate, { locale: vi });
  const reminderActionText = overdue ? "đã quá hạn lúc" : "sẽ hết hạn lúc";
  const fallbackSubject = overdue ? "Thẻ đã quá hạn" : "Thẻ sẽ hết hạn";

  return {
    title: overdue ? "Thẻ đã quá hạn" : "Thẻ sắp đến hạn",
    message: cardTitle
      ? `Thẻ "${cardTitle}" ${reminderActionText} ${timeText}`
      : `${fallbackSubject} lúc ${timeText}`,
    dueDateText: format(dueDate, "dd/MM/yyyy 'lúc' HH:mm", { locale: vi }),
    statusText: overdue
      ? `Quá hạn ${relative} trước`
      : `Còn ${relative} nữa đến hạn`,
    overdue,
  };
};
