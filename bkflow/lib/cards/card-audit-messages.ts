import { ACTION, AUDIT_EVENT_TYPE, type Card } from "@prisma/client";

import type { UpdateCardInput } from "@/lib/cards/update-card-contract";
import { formatDateTimeInOffset } from "@/lib/date-utils";

export const formatFriendlyDate = (
  dateValue: Date | string,
  timezoneOffsetMinutes?: number,
) => {
  const date = new Date(dateValue);
  const timeStr = formatDateTimeInOffset(
    date,
    "HH:mm",
    timezoneOffsetMinutes,
  );
  const dateKey = formatDateTimeInOffset(
    date,
    "yyyy-MM-dd",
    timezoneOffsetMinutes,
  );
  const todayKey = formatDateTimeInOffset(
    new Date(),
    "yyyy-MM-dd",
    timezoneOffsetMinutes,
  );
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowKey = formatDateTimeInOffset(
    tomorrow,
    "yyyy-MM-dd",
    timezoneOffsetMinutes,
  );

  if (dateKey === todayKey) {
    return `Hôm nay lúc ${timeStr}`;
  }

  if (dateKey === tomorrowKey) {
    return `Ngày mai lúc ${timeStr}`;
  }

  return `${formatDateTimeInOffset(date, "dd/MM/yyyy", timezoneOffsetMinutes)} lúc ${timeStr}`;
};

export const buildUpdateCardAuditMessage = ({
  input,
  card,
  currentCard,
  startDateChanged,
  dueDateChanged,
}: {
  input: Pick<
    UpdateCardInput,
    | "title"
    | "description"
    | "startDate"
    | "dueDate"
    | "dueDateTimezoneOffset"
    | "isCompleted"
  >;
  card: Pick<Card, "title" | "startDate" | "dueDate">;
  currentCard: Pick<Card, "title" | "description" | "isCompleted">;
  startDateChanged: boolean;
  dueDateChanged: boolean;
}) => {
  let auditLogMessage = card.title;
  const { dueDateTimezoneOffset } = input;

  if (startDateChanged && dueDateChanged) {
    const startText = card.startDate
      ? formatFriendlyDate(card.startDate, dueDateTimezoneOffset)
      : "không có ngày bắt đầu";
    const dueText = card.dueDate
      ? formatFriendlyDate(card.dueDate, dueDateTimezoneOffset)
      : "không có ngày hết hạn";
    auditLogMessage = `detail:đã cập nhật khoảng thời gian của thẻ "${card.title}" từ ${startText} đến ${dueText}`;
  } else if (
    input.isCompleted !== undefined &&
    input.isCompleted !== currentCard.isCompleted
  ) {
    if (input.isCompleted) {
      auditLogMessage = `detail:đã đánh dấu thẻ "${card.title}" là hoàn thành`;
    } else {
      auditLogMessage = `detail:đã bỏ đánh dấu hoàn thành cho thẻ "${card.title}"`;
    }
  } else if (startDateChanged) {
    if (input.startDate === null) {
      auditLogMessage = `detail:đã bỏ ngày bắt đầu của thẻ "${card.title}"`;
    } else if (card.startDate) {
      const formatted = formatFriendlyDate(
        card.startDate,
        dueDateTimezoneOffset,
      );
      auditLogMessage = `detail:đã đặt ngày bắt đầu cho thẻ "${card.title}" là ${formatted}`;
    }
  } else if (dueDateChanged) {
    if (input.dueDate === null) {
      auditLogMessage = `detail:đã bỏ ngày hết hạn của thẻ "${card.title}"`;
    } else if (card.dueDate) {
      const formatted = formatFriendlyDate(
        card.dueDate,
        dueDateTimezoneOffset,
      );
      auditLogMessage = `detail:đã đặt ngày hết hạn cho thẻ "${card.title}" là ${formatted}`;
    }
  } else if (
    input.description !== undefined &&
    input.description !== currentCard.description
  ) {
    if (!currentCard.description && input.description) {
      auditLogMessage = `detail:đã thêm mô tả cho thẻ "${card.title}"`;
    } else if (currentCard.description && !input.description) {
      auditLogMessage = `detail:đã xóa mô tả của thẻ "${card.title}"`;
    } else {
      auditLogMessage = `detail:đã cập nhật mô tả cho thẻ "${card.title}"`;
    }
  } else if (input.title !== undefined && input.title !== currentCard.title) {
    auditLogMessage = `detail:đã đổi tên thẻ thành "${input.title}"`;
  }

  return auditLogMessage;
};

export const getUpdateCardAuditEventType = ({
  startDateChanged,
  dueDateChanged,
  reminderConfigChanged,
  isCompleted,
}: {
  startDateChanged: boolean;
  dueDateChanged: boolean;
  reminderConfigChanged: boolean;
  isCompleted?: boolean;
}) => (
  startDateChanged ||
  dueDateChanged ||
  reminderConfigChanged ||
  isCompleted !== undefined
)
  ? AUDIT_EVENT_TYPE.DUE_DATE
  : AUDIT_EVENT_TYPE.UPDATE;

export const UPDATE_CARD_AUDIT_ACTION = ACTION.UPDATE;
