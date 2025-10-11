"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { format, isToday, isTomorrow } from "date-fns";

import { db } from "@/lib/db";
import { createSafeAction } from "@/lib/create-safe-action";

import { UpdateCard } from "./schema";
import { InputType, ReturnType } from "./types";
import { createAuditLog } from "@/lib/create-audit-log";
import { ACTION, ENTITY_TYPE } from "@prisma/client";
import { deleteCardReminderNotifications } from "@/lib/reminder-notifications";
import { requireBoardMember } from "@/lib/permissions";
import { triggerCardUpdated } from "@/lib/cards/realtime";
import type { CardUpdatedField } from "@/lib/realtime/types";

const formatFriendlyDate = (dueDate: Date | string) => {
  const date = new Date(dueDate);
  const timeStr = format(date, "HH:mm");

  if (isToday(date)) {
    return `Hôm nay lúc ${timeStr}`;
  }
  if (isTomorrow(date)) {
    return `Ngày mai lúc ${timeStr}`;
  }
  return `${format(date, "dd/MM/yyyy")} lúc ${timeStr}`;
};

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId, orgId } = await auth();

  if (!userId || !orgId) {
    return {
      error: "Không có quyền truy cập.",
    };
  }

  const { id, boardId, dueDate, isCompleted, reminder, ...values } = data;
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
        error: "Không tìm thấy thẻ."
      };
    }

    // Determine if reminder config is changing (dueDate or reminder value)
    const dueDateChanged = dueDate !== undefined && (
      (dueDate === null && currentCard.dueDate !== null) ||
      (dueDate !== null && currentCard.dueDate === null) ||
      (dueDate !== null && currentCard.dueDate !== null &&
        new Date(dueDate).getTime() !== new Date(currentCard.dueDate).getTime())
    );
    const reminderChanged = reminder !== undefined && reminder !== currentCard.reminder;
    const reminderConfigChanged = dueDateChanged || reminderChanged;
    const changedFields: CardUpdatedField[] = [];

    if (values.title !== undefined && values.title !== currentCard.title) {
      changedFields.push("title");
    }

    if (
      values.description !== undefined &&
      values.description !== currentCard.description
    ) {
      changedFields.push("description");
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
      ...(dueDate !== undefined ? { dueDate } : {}),
      ...(isCompleted !== undefined ? { isCompleted } : {}),
      ...(reminder !== undefined ? { reminder } : {}),
      // Only update reminderSetAt when reminder config actually changes
      ...(reminderConfigChanged ? { reminderSetAt: new Date() } : {}),
      // Clear reminderSetAt when due date is removed
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

    if (isCompleted !== undefined && isCompleted !== currentCard.isCompleted) {
      if (isCompleted) {
        auditLogMessage = "detail:đã đánh dấu thẻ này là hoàn thành";
      } else {
        auditLogMessage = "detail:đã bỏ đánh dấu hoàn thành cho thẻ này";
      }
    } else if (dueDate !== undefined && (
      (dueDate === null && currentCard.dueDate !== null) ||
      (dueDate !== null && currentCard.dueDate === null) ||
      (dueDate !== null && currentCard.dueDate !== null && new Date(dueDate).getTime() !== new Date(currentCard.dueDate).getTime())
    )) {
      if (dueDate === null) {
        auditLogMessage = "detail:đã bỏ ngày hết hạn của thẻ này";
      } else {
        const formatted = formatFriendlyDate(dueDate);
        auditLogMessage = `detail:đã đặt ngày hết hạn cho thẻ này là ${formatted}`;
      }
    } else if (values.description !== undefined && values.description !== currentCard.description) {
      if (!currentCard.description && values.description) {
        auditLogMessage = "detail:đã thêm mô tả cho thẻ này";
      } else if (currentCard.description && !values.description) {
        auditLogMessage = "detail:đã xóa mô tả của thẻ này";
      } else {
        auditLogMessage = "detail:đã cập nhật mô tả cho thẻ này";
      }
    } else if (values.title !== undefined && values.title !== currentCard.title) {
      auditLogMessage = `detail:đã đổi tên thẻ thành "${values.title}"`;
    }

    await createAuditLog({
      entityTitle: auditLogMessage,
      entityId: card.id,
      entityType: ENTITY_TYPE.CARD,
      action: ACTION.UPDATE,
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
      error: "Cập nhật thẻ thất bại."
    }
  }

  revalidatePath(`/board/${boardId}`);
  return { data: card };
};

export const updateCard = createSafeAction(UpdateCard, handler);
