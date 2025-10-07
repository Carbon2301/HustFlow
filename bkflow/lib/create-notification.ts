import { NOTIFICATION_TYPE, Notification, Prisma } from "@prisma/client";

import { db } from "@/lib/db";
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
      try {
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
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          return;
        }

        throw error;
      }
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
    console.log("[CREATE_NOTIFICATION_ERROR]", error);
  }
};

export const createNotifications = async (
  notifications: CreateNotificationInput[],
) => {
  await Promise.all(notifications.map(createNotification));
};
