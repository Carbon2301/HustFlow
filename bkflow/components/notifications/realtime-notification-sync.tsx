"use client";

import { useCallback, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { useQueryClient } from "@tanstack/react-query";

import { NotificationItem } from "@/components/notifications/types";
import { NOTIFICATIONS_QUERY_KEY } from "@/hooks/use-notifications";
import {
  useRealtimeChannel,
  useRealtimeInvalidation,
} from "@/hooks/use-realtime-channel";
import { realtimeChannels } from "@/lib/realtime/channels";
import { isRealtimeClientConfigured } from "@/lib/realtime/client";
import { REALTIME_EVENTS } from "@/lib/realtime/events";
import type { NotificationCreatedPayload } from "@/lib/realtime/types";

const toNotificationItem = (
  payload: NotificationCreatedPayload,
): NotificationItem => ({
  id: payload.notificationId,
  orgId: payload.orgId,
  recipientUserId: payload.recipientUserId,
  actorUserId: payload.actor?.userId ?? null,
  actorName: payload.actor?.name ?? null,
  actorImage: payload.actor?.image ?? null,
  type: payload.type,
  title: payload.title,
  message: payload.message,
  boardId: payload.boardId ?? null,
  boardTitle: null,
  cardId: payload.cardId ?? null,
  cardTitle: null,
  listTitle: null,
  commentId: payload.commentId ?? null,
  dueDate: null,
  triggerTime: null,
  reminderLabel: null,
  dedupeKey: null,
  readAt: null,
  createdAt: payload.createdAt,
  updatedAt: payload.createdAt,
});

export const RealtimeNotificationSync = () => {
  const { user, isLoaded } = useUser();
  const queryClient = useQueryClient();
  const invalidateRealtimeQueries = useRealtimeInvalidation();
  const receivedIdsRef = useRef<Set<string>>(new Set());

  const handleNotificationCreated = useCallback(
    (payload: NotificationCreatedPayload) => {
      if (!user || payload.recipientUserId !== user.id) {
        return;
      }

      if (receivedIdsRef.current.has(payload.notificationId)) {
        return;
      }

      receivedIdsRef.current.add(payload.notificationId);

      queryClient.setQueryData<NotificationItem[]>(
        NOTIFICATIONS_QUERY_KEY,
        (currentNotifications = []) => {
          const exists = currentNotifications.some(
            (notification) => notification.id === payload.notificationId,
          );

          if (exists) {
            return currentNotifications;
          }

          return [toNotificationItem(payload), ...currentNotifications].slice(
            0,
            50,
          );
        },
      );

      invalidateRealtimeQueries(payload.invalidate);
    },
    [invalidateRealtimeQueries, queryClient, user],
  );

  useRealtimeChannel({
    channelName: user ? realtimeChannels.user(user.id) : null,
    event: REALTIME_EVENTS.NOTIFICATION_CREATED,
    onEvent: handleNotificationCreated,
    enabled: isLoaded && Boolean(user) && isRealtimeClientConfigured(),
  });

  return null;
};
