import "server-only";

import type { Notification } from "@prisma/client";

import { realtimeChannels } from "@/lib/realtime/channels";
import { REALTIME_EVENTS } from "@/lib/realtime/events";
import { logger } from "@/lib/logger";
import { triggerRealtimeEvent } from "@/lib/realtime/server";

export const triggerNotificationCreated = async (
  notification: Notification,
) => {
  try {
    await triggerRealtimeEvent({
      channel: realtimeChannels.user(notification.recipientUserId),
      event: REALTIME_EVENTS.NOTIFICATION_CREATED,
      payload: {
        notificationId: notification.id,
        orgId: notification.orgId,
        recipientUserId: notification.recipientUserId,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        actor: notification.actorUserId
          ? {
              userId: notification.actorUserId,
              name: notification.actorName ?? "Thanh vien",
              image: notification.actorImage,
            }
          : null,
        boardId: notification.boardId,
        boardTitle: notification.boardTitle,
        cardId: notification.cardId,
        cardTitle: notification.cardTitle,
        listTitle: notification.listTitle,
        commentId: notification.commentId,
        dueDate: notification.dueDate?.toISOString() ?? null,
        triggerTime: notification.triggerTime?.toISOString() ?? null,
        reminderLabel: notification.reminderLabel,
        dedupeKey: notification.dedupeKey,
        createdAt: notification.createdAt.toISOString(),
        updatedAt: notification.updatedAt.toISOString(),
        invalidate: [
          {
            queryKey: ["notifications"],
          },
        ],
      },
    });
  } catch (error) {
    logger.error("[NOTIFICATION_REALTIME_ERROR]", error, {
      action: "notification-realtime",
      eventType: notification.type,
      orgId: notification.orgId,
      boardId: notification.boardId,
      cardId: notification.cardId,
    });
  }
};
