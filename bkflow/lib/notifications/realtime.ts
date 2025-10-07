import "server-only";

import type { Notification } from "@prisma/client";

import { realtimeChannels } from "@/lib/realtime/channels";
import { REALTIME_EVENTS } from "@/lib/realtime/events";
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
        cardId: notification.cardId,
        commentId: notification.commentId,
        createdAt: notification.createdAt.toISOString(),
        invalidate: [
          {
            queryKey: ["notifications"],
          },
        ],
      },
    });
  } catch (error) {
    console.error("[NOTIFICATION_REALTIME_ERROR]", error);
  }
};
