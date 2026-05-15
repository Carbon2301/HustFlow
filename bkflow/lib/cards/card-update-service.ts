import { ENTITY_TYPE, type Card } from "@prisma/client";

import type { InputType, ReturnType } from "@/actions/update-card/types";
import { createAuditLog } from "@/lib/create-audit-log";
import { db } from "@/lib/db";
import { deleteCardReminderNotifications } from "@/lib/reminder-notifications";
import { requireBoardEditor } from "@/lib/permissions";
import {
  triggerCardUpdated,
  triggerRelatedDependencyCardsUpdated,
} from "@/lib/cards/realtime";
import {
  buildUpdateCardAuditMessage,
  getUpdateCardAuditEventType,
  UPDATE_CARD_AUDIT_ACTION,
} from "@/lib/cards/card-audit-messages";
import {
  buildCardUpdateData,
  getChangedCardFields,
  getEffectiveCardDates,
  hasDateChanged,
  shouldDeleteReminderNotifications,
  validateCardDateRange,
  validateReminderConfig,
} from "@/lib/cards/card-date-rules";

type UpdateCardServiceInput = {
  data: InputType;
  userId: string;
  orgId: string;
};

export const DESCRIPTION_CONFLICT_ERROR_CODE = "DESCRIPTION_CONFLICT";
export const DESCRIPTION_CONFLICT_ERROR_MESSAGE =
  "Dữ liệu đã được cập nhật bởi một thành viên khác. Vui lòng lưu và reload lại.";

export const updateCardService = async ({
  data,
  userId,
  orgId,
}: UpdateCardServiceInput): Promise<ReturnType> => {
  const {
    id,
    boardId,
    startDate,
    dueDate,
    isCompleted,
    reminder,
    dueDateTimezoneOffset,
    descriptionBaseUpdatedAt,
    ...values
  } = data;
  let card: Card;

  try {
    const permission = await requireBoardEditor({ boardId, orgId, userId });

    if (permission.error) {
      return { error: permission.error };
    }

    const currentCard = await db.card.findFirst({
      where: {
        id,
        archivedAt: null,
        list: {
          archivedAt: null,
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
    const { effectiveStartDate, effectiveDueDate } = getEffectiveCardDates({
      startDate,
      dueDate,
      currentCard,
    });

    const dateRangeError = validateCardDateRange(
      effectiveStartDate,
      effectiveDueDate,
    );

    if (dateRangeError) {
      return { error: dateRangeError };
    }

    if (reminderConfigChanged) {
      const effectiveReminder = reminder !== undefined
        ? reminder
        : currentCard.reminder;
      const reminderError = validateReminderConfig({
        dueDate: effectiveDueDate,
        reminder: effectiveReminder,
      });

      if (reminderError) {
        return { error: reminderError };
      }
    }

    const changeInput = {
      ...values,
      startDate,
      dueDate,
      isCompleted,
      reminder,
    };
    const changedFields = getChangedCardFields({
      input: changeInput,
      currentCard,
      startDateChanged,
      dueDateChanged,
      reminderChanged,
      reminderConfigChanged,
    });

    if (changedFields.length === 0) {
      return { data: currentCard };
    }

    const descriptionChanged = changedFields.includes("description");
    let descriptionBaseDate: Date | null = null;

    if (descriptionChanged) {
      descriptionBaseDate = descriptionBaseUpdatedAt
        ? new Date(descriptionBaseUpdatedAt)
        : null;

      if (
        !descriptionBaseDate ||
        currentCard.descriptionUpdatedAt.getTime() > descriptionBaseDate.getTime()
      ) {
        return {
          error: DESCRIPTION_CONFLICT_ERROR_MESSAGE,
          errorCode: DESCRIPTION_CONFLICT_ERROR_CODE,
        };
      }
    }

    const updateData = buildCardUpdateData({
      input: changeInput,
      reminderConfigChanged,
      descriptionChanged,
    });

    const cardWhere = {
      id,
      archivedAt: null,
      list: {
        archivedAt: null,
        board: {
          id: boardId,
          orgId,
        },
      },
    };

    if (descriptionChanged) {
      const updateResult = await db.card.updateMany({
        where: {
          ...cardWhere,
          descriptionUpdatedAt: {
            lte: descriptionBaseDate!,
          },
        },
        data: updateData,
      });

      if (updateResult.count === 0) {
        return {
          error: DESCRIPTION_CONFLICT_ERROR_MESSAGE,
          errorCode: DESCRIPTION_CONFLICT_ERROR_CODE,
        };
      }

      const updatedCard = await db.card.findFirst({
        where: cardWhere,
      });

      if (!updatedCard) {
        return {
          error: "Không tìm thấy thẻ.",
        };
      }

      card = updatedCard;
    } else {
      card = await db.card.update({
        where: cardWhere,
        data: updateData,
      });
    }

    if (
      shouldDeleteReminderNotifications({
        reminderConfigChanged,
        dueDate,
        isCompleted,
      })
    ) {
      await deleteCardReminderNotifications(card.id);
    }

    const auditLogMessage = buildUpdateCardAuditMessage({
      input: {
        ...values,
        startDate,
        dueDate,
        isCompleted,
        dueDateTimezoneOffset,
      },
      card,
      currentCard,
      startDateChanged,
      dueDateChanged,
    });

    await createAuditLog({
      entityTitle: auditLogMessage,
      entityId: card.id,
      entityType: ENTITY_TYPE.CARD,
      action: UPDATE_CARD_AUDIT_ACTION,
      eventType: getUpdateCardAuditEventType({
        startDateChanged,
        dueDateChanged,
        reminderConfigChanged,
        isCompleted,
      }),
      boardId,
      cardId: card.id,
    });

    await triggerCardUpdated({
      boardId,
      cardId: card.id,
      actorUserId: userId,
      changedFields,
      card,
      updatedAt: card.updatedAt,
    });

    if (isCompleted !== undefined && isCompleted !== currentCard.isCompleted) {
      const dependencyCards = await db.cardDependency.findMany({
        where: {
          OR: [
            {
              blockerCardId: card.id,
            },
            {
              blockedCardId: card.id,
            },
          ],
        },
        select: {
          blockerCardId: true,
          blockedCardId: true,
        },
      });
      const relatedCardIds = dependencyCards.map((dependency) =>
        dependency.blockerCardId === card.id
          ? dependency.blockedCardId
          : dependency.blockerCardId,
      );

      await triggerRelatedDependencyCardsUpdated({
        boardId,
        sourceCardId: card.id,
        relatedCardIds,
        actorUserId: userId,
      });
    }
  } catch {
    return {
      error: "Cập nhật thẻ thất bại.",
    };
  }

  return { data: card };
};
