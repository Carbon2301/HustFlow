"use server";

import { auth } from "@clerk/nextjs/server";
import { ACTION, AUDIT_EVENT_TYPE, ENTITY_TYPE } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { createAuditLog } from "@/lib/create-audit-log";
import { createSafeAction } from "@/lib/create-safe-action";
import { db } from "@/lib/db";
import { formatDateTimeInOffset } from "@/lib/date-utils";
import { deleteCardReminderNotifications } from "@/lib/reminder-notifications";
import { requireBoardMember } from "@/lib/permissions";
import { triggerCardUpdated } from "@/lib/cards/realtime";
import type { CardUpdatedField } from "@/lib/realtime/types";

import { UpdateCard } from "./schema";
import { InputType, ReturnType } from "./types";

const formatFriendlyDate = (
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

const hasDateChanged = (
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

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId, orgId } = await auth();

  if (!userId || !orgId) {
    return {
      error: "Không có quyền truy cập.",
    };
  }

  const {
    id,
    boardId,
    startDate,
    dueDate,
    dueDateTimezoneOffset,
    isCompleted,
    reminder,
    ...values
  } = data;
  let card;

  try {
    const permission = await requireBoardMember({ boardId, orgId, userId });

    if (permission.error) {
      return { error: permission.error };
    }

    const currentCard = await db.card.findUnique({
      where: {
        id,
        list: {
          board: {
            id: boardId,
            orgId,
          },
        },
      },
    });

    if (!currentCard) {
      return {
        error: "Không tìm thấy thẻ.",
      };
    }

    const startDateChanged = hasDateChanged(startDate, currentCard.startDate);
    const dueDateChanged = hasDateChanged(dueDate, currentCard.dueDate);
    const reminderChanged = reminder !== undefined && reminder !== currentCard.reminder;
    const reminderConfigChanged = dueDateChanged || reminderChanged;
    const changedFields: CardUpdatedField[] = [];

    const effectiveStartDate = startDate !== undefined
      ? startDate
      : currentCard.startDate;
    const effectiveDueDate = dueDate !== undefined
      ? dueDate
      : currentCard.dueDate;

    if (
      effectiveStartDate &&
      effectiveDueDate &&
      new Date(effectiveStartDate).getTime() >
        new Date(effectiveDueDate).getTime()
    ) {
      return {
        error: "Ngày bắt đầu phải trước hoặc bằng ngày hết hạn.",
      };
    }

    if (reminderConfigChanged) {
      const effectiveReminder = reminder !== undefined
        ? reminder
        : currentCard.reminder;

      if (
        effectiveDueDate &&
        effectiveReminder &&
        effectiveReminder !== "none"
      ) {
        const offsetMinutes = parseInt(effectiveReminder, 10);

        if (Number.isNaN(offsetMinutes)) {
          return { error: "Mốc nhắc nhở không hợp lệ." };
        }

        const triggerTime =
          new Date(effectiveDueDate).getTime() - offsetMinutes * 60_000;

        if (triggerTime < Date.now()) {
          return {
            error: "Thời gian nhắc nhở đã ở trong quá khứ. Hãy chọn mốc nhắc ngắn hơn hoặc đổi ngày hết hạn.",
          };
        }
      }
    }

    if (values.title !== undefined && values.title !== currentCard.title) {
      changedFields.push("title");
    }

    if (
      values.description !== undefined &&
      values.description !== currentCard.description
    ) {
      changedFields.push("description");
    }

    if (startDateChanged) {
      changedFields.push("startDate");
    }

    if (dueDateChanged) {
      changedFields.push("dueDate");
    }

    if (isCompleted !== undefined && isCompleted !== currentCard.isCompleted) {
      changedFields.push("isCompleted");
    }

    if (reminderChanged) {
      changedFields.push("reminder");
    }

    if (reminderConfigChanged || dueDate === null) {
      changedFields.push("reminderSetAt");
    }

    if (changedFields.length === 0) {
      return { data: currentCard };
    }

    const updateData = {
      ...values,
      ...(startDate !== undefined ? { startDate } : {}),
      ...(dueDate !== undefined ? { dueDate } : {}),
      ...(isCompleted !== undefined ? { isCompleted } : {}),
      ...(reminder !== undefined ? { reminder } : {}),
      ...(reminderConfigChanged ? { reminderSetAt: new Date() } : {}),
      ...(dueDate === null ? { reminderSetAt: null } : {}),
    };

    card = await db.card.update({
      where: {
        id,
        list: {
          board: {
            id: boardId,
            orgId,
          },
        },
      },
      data: updateData,
    });

    if (
      reminderConfigChanged ||
      dueDate === null ||
      isCompleted === true
    ) {
      await deleteCardReminderNotifications(card.id);
    }

    let auditLogMessage = card.title;

    if (startDateChanged && dueDateChanged) {
      const startText = card.startDate
        ? formatFriendlyDate(card.startDate, dueDateTimezoneOffset)
        : "không có ngày bắt đầu";
      const dueText = card.dueDate
        ? formatFriendlyDate(card.dueDate, dueDateTimezoneOffset)
        : "không có ngày hết hạn";
      auditLogMessage = `detail:đã cập nhật khoảng thời gian của thẻ "${card.title}" từ ${startText} đến ${dueText}`;
    } else if (isCompleted !== undefined && isCompleted !== currentCard.isCompleted) {
      if (isCompleted) {
        auditLogMessage = `detail:đã đánh dấu thẻ "${card.title}" là hoàn thành`;
      } else {
        auditLogMessage = `detail:đã bỏ đánh dấu hoàn thành cho thẻ "${card.title}"`;
      }
    } else if (startDateChanged) {
      if (startDate === null) {
        auditLogMessage = `detail:đã bỏ ngày bắt đầu của thẻ "${card.title}"`;
      } else if (card.startDate) {
        const formatted = formatFriendlyDate(
          card.startDate,
          dueDateTimezoneOffset,
        );
        auditLogMessage = `detail:đã đặt ngày bắt đầu cho thẻ "${card.title}" là ${formatted}`;
      }
    } else if (dueDateChanged) {
      if (dueDate === null) {
        auditLogMessage = `detail:đã bỏ ngày hết hạn của thẻ "${card.title}"`;
      } else if (card.dueDate) {
        const formatted = formatFriendlyDate(
          card.dueDate,
          dueDateTimezoneOffset,
        );
        auditLogMessage = `detail:đã đặt ngày hết hạn cho thẻ "${card.title}" là ${formatted}`;
      }
    } else if (values.description !== undefined && values.description !== currentCard.description) {
      if (!currentCard.description && values.description) {
        auditLogMessage = `detail:đã thêm mô tả cho thẻ "${card.title}"`;
      } else if (currentCard.description && !values.description) {
        auditLogMessage = `detail:đã xóa mô tả của thẻ "${card.title}"`;
      } else {
        auditLogMessage = `detail:đã cập nhật mô tả cho thẻ "${card.title}"`;
      }
    } else if (values.title !== undefined && values.title !== currentCard.title) {
      auditLogMessage = `detail:đã đổi tên thẻ thành "${values.title}"`;
    }

    await createAuditLog({
      entityTitle: auditLogMessage,
      entityId: card.id,
      entityType: ENTITY_TYPE.CARD,
      action: ACTION.UPDATE,
      eventType: (
        startDateChanged ||
        dueDateChanged ||
        reminderConfigChanged ||
        isCompleted !== undefined
      )
        ? AUDIT_EVENT_TYPE.DUE_DATE
        : AUDIT_EVENT_TYPE.UPDATE,
      boardId,
      cardId: card.id,
    });

    await triggerCardUpdated({
      boardId,
      cardId: card.id,
      actorUserId: userId,
      changedFields,
      updatedAt: card.updatedAt,
    });
  } catch {
    return {
      error: "Cập nhật thẻ thất bại.",
    };
  }

  revalidatePath(`/board/${boardId}`);
  return { data: card };
};

export const updateCard = createSafeAction(UpdateCard, handler);
