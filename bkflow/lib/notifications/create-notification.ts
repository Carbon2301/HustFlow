import { NOTIFICATION_TYPE, Notification } from "@prisma/client";

import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { triggerNotificationCreated } from "@/lib/notifications/realtime";

type NotificationActor = {
  userId: string;
  name: string;
  image: string;
};

type CreateNotificationInput = {
  orgId: string;
  recipientUserId: string;
  actor?: NotificationActor | null;
  type: NOTIFICATION_TYPE;
  title: string;
  message: string;
  boardId?: string | null;
  boardTitle?: string | null;
  cardId?: string | null;
  cardTitle?: string | null;
  listTitle?: string | null;
  commentId?: string | null;
  dueDate?: Date | null;
  triggerTime?: Date | null;
  reminderLabel?: string | null;
  dedupeKey?: string | null;
};

export const createNotification = async ({
  orgId,
  recipientUserId,
  actor,
  type,
  title,
  message,
  boardId,
  boardTitle,
  cardId,
  cardTitle,
  listTitle,
  commentId,
  dueDate,
  triggerTime,
  reminderLabel,
  dedupeKey,
}: CreateNotificationInput) => {
  try {
    if (actor?.userId === recipientUserId) {
      return;
    }

    let notification: Notification;

    if (dedupeKey) {
      const existingNotification = await db.notification.findFirst({
        where: {
          dedupeKey,
          ...(type === NOTIFICATION_TYPE.CARD_REMINDER
            ? {}
            : { readAt: null }),
        },
        select: {
          id: true,
        },
      });

      if (existingNotification) {
        return;
      }

      notification = await db.notification.create({
        data: {
          orgId,
          recipientUserId,
          actorUserId: actor?.userId,
          actorName: actor?.name,
          actorImage: actor?.image,
          type,
          title,
          message,
          boardId,
          boardTitle,
          cardId,
          cardTitle,
          listTitle,
          commentId,
          dueDate,
          triggerTime,
          reminderLabel,
          dedupeKey,
        },
      });
    } else {
      notification = await db.notification.create({
        data: {
          orgId,
          recipientUserId,
          actorUserId: actor?.userId,
          actorName: actor?.name,
          actorImage: actor?.image,
          type,
          title,
          message,
          boardId,
          boardTitle,
          cardId,
          cardTitle,
          listTitle,
          commentId,
          dueDate,
          triggerTime,
          reminderLabel,
          dedupeKey,
        },
      });
    }

    await triggerNotificationCreated(notification);
  } catch (error) {
    logger.error("[CREATE_NOTIFICATION_ERROR]", error, {
      action: "create-notification",
      eventType: type,
      orgId,
      boardId,
      cardId,
      commentId,
    });
  }
};

export const createNotifications = async (
  notifications: CreateNotificationInput[],
) => {
  await Promise.all(notifications.map(createNotification));
};
