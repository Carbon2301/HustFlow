import type { Card, Prisma } from "@prisma/client";

import type { InputType } from "@/actions/cards/update-card/types";
import type { CardUpdatedField } from "@/lib/realtime/types";

type CardDateInput = Pick<
  InputType,
  | "title"
  | "description"
  | "startDate"
  | "dueDate"
  | "isCompleted"
  | "reminder"
>;

type EffectiveCardDatesInput = Pick<InputType, "startDate" | "dueDate"> & {
  currentCard: Pick<Card, "startDate" | "dueDate">;
};

export const hasDateChanged = (
  nextDate: Date | null | undefined,
  currentDate: Date | null,
) => (
  nextDate !== undefined && (
    (nextDate === null && currentDate !== null) ||
    (nextDate !== null && currentDate === null) ||
    (nextDate !== null && currentDate !== null &&
      new Date(nextDate).getTime() !== new Date(currentDate).getTime())
  )
);

export const getEffectiveCardDates = ({
  startDate,
  dueDate,
  currentCard,
}: EffectiveCardDatesInput) => ({
  effectiveStartDate: startDate !== undefined
    ? startDate
    : currentCard.startDate,
  effectiveDueDate: dueDate !== undefined
    ? dueDate
    : currentCard.dueDate,
});

export const validateCardDateRange = (
  startDate: Date | null,
  dueDate: Date | null,
) => {
  if (
    startDate &&
    dueDate &&
    new Date(startDate).getTime() > new Date(dueDate).getTime()
  ) {
    return "Ngày bắt đầu phải trước hoặc bằng ngày hết hạn.";
  }

  return null;
};

export const validateReminderConfig = ({
  dueDate,
  reminder,
}: {
  dueDate: Date | null;
  reminder: string | null;
}) => {
  if (!dueDate || !reminder || reminder === "none") {
    return null;
  }

  const offsetMinutes = parseInt(reminder, 10);

  if (Number.isNaN(offsetMinutes)) {
    return "Mốc nhắc nhở không hợp lệ.";
  }

  const triggerTime = new Date(dueDate).getTime() - offsetMinutes * 60_000;

  if (triggerTime < Date.now()) {
    return "Thời gian nhắc nhở đã ở trong quá khứ. Hãy chọn mốc nhắc ngắn hơn hoặc đổi ngày hết hạn.";
  }

  return null;
};

export const getChangedCardFields = ({
  input,
  currentCard,
  startDateChanged,
  dueDateChanged,
  reminderChanged,
  reminderConfigChanged,
}: {
  input: CardDateInput;
  currentCard: Pick<Card, "title" | "description" | "isCompleted">;
  startDateChanged: boolean;
  dueDateChanged: boolean;
  reminderChanged: boolean;
  reminderConfigChanged: boolean;
}) => {
  const changedFields: CardUpdatedField[] = [];

  if (input.title !== undefined && input.title !== currentCard.title) {
    changedFields.push("title");
  }

  if (
    input.description !== undefined &&
    input.description !== currentCard.description
  ) {
    changedFields.push("description");
  }

  if (startDateChanged) {
    changedFields.push("startDate");
  }

  if (dueDateChanged) {
    changedFields.push("dueDate");
  }

  if (
    input.isCompleted !== undefined &&
    input.isCompleted !== currentCard.isCompleted
  ) {
    changedFields.push("isCompleted");
  }

  if (reminderChanged) {
    changedFields.push("reminder");
  }

  if (reminderConfigChanged || input.dueDate === null) {
    changedFields.push("reminderSetAt");
  }

  return changedFields;
};

export const buildCardUpdateData = ({
  input,
  reminderConfigChanged,
  descriptionChanged,
}: {
  input: CardDateInput;
  reminderConfigChanged: boolean;
  descriptionChanged: boolean;
}): Prisma.CardUpdateInput => {
  const { startDate, dueDate, isCompleted, reminder, ...values } = input;

  return {
    ...values,
    ...(startDate !== undefined ? { startDate } : {}),
    ...(dueDate !== undefined ? { dueDate } : {}),
    ...(isCompleted !== undefined ? { isCompleted } : {}),
    ...(reminder !== undefined ? { reminder } : {}),
    ...(descriptionChanged ? { descriptionUpdatedAt: new Date() } : {}),
    ...(reminderConfigChanged ? { reminderSetAt: new Date() } : {}),
    ...(dueDate === null ? { reminderSetAt: null } : {}),
  };
};

export const shouldDeleteReminderNotifications = ({
  reminderConfigChanged,
  dueDate,
  isCompleted,
}: {
  reminderConfigChanged: boolean;
  dueDate?: Date | null;
  isCompleted?: boolean;
}) => reminderConfigChanged || dueDate === null || isCompleted === true;
