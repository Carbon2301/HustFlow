import { NOTIFICATION_TYPE } from "@prisma/client";

import { db } from "@/lib/db";

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

    if (dedupeKey) {
      await db.notification.upsert({
        where: {
          dedupeKey,
        },
        update: {},
        create: {
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
      return;
    }

    await db.notification.create({
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
    console.log("[CREATE_NOTIFICATION_ERROR]", error);
  }
};

export const createNotifications = async (
  notifications: CreateNotificationInput[],
) => {
  await Promise.all(notifications.map(createNotification));
};
