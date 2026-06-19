"use client";

import { useCallback, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { fetcher } from "@/lib/fetcher";
import { NotificationItem } from "@/components/notifications/types";

export const NOTIFICATIONS_QUERY_KEY = ["notifications"] as const;

const patchNotification = async (id: string, read: boolean) => {
  const response = await fetch(`/api/notifications/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ read }),
  });

  if (!response.ok) {
    throw new Error("Failed to update notification");
  }

  return response.json();
};

const patchAllNotificationsRead = async () => {
  const response = await fetch("/api/notifications/read-all", {
    method: "PATCH",
  });

  if (!response.ok) {
    throw new Error("Failed to update notifications");
  }

  return response.json();
};

export const useNotifications = () => {
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery<NotificationItem[]>({
    queryKey: NOTIFICATIONS_QUERY_KEY,
    queryFn: () => fetcher("/api/notifications"),
    refetchInterval: 30000,
  });

  const invalidateNotifications = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
  }, [queryClient]);

  const { mutate: markNotification } = useMutation({
    mutationFn: ({ id, read }: { id: string; read: boolean }) =>
      patchNotification(id, read),
    onMutate: async ({ id, read }) => {
      await queryClient.cancelQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });

      const previousNotifications =
        queryClient.getQueryData<NotificationItem[]>(NOTIFICATIONS_QUERY_KEY);
      const readAt = read ? new Date().toISOString() : null;

      queryClient.setQueryData<NotificationItem[]>(
        NOTIFICATIONS_QUERY_KEY,
        (currentNotifications = []) =>
          currentNotifications.map((notification) =>
            notification.id === id
              ? { ...notification, readAt }
              : notification,
          ),
      );

      return { previousNotifications };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousNotifications) {
        queryClient.setQueryData(
          NOTIFICATIONS_QUERY_KEY,
          context.previousNotifications,
        );
      }
    },
    onSettled: invalidateNotifications,
  });

  const { mutate: markAllNotifications } = useMutation({
    mutationFn: patchAllNotificationsRead,
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });

      const previousNotifications =
        queryClient.getQueryData<NotificationItem[]>(NOTIFICATIONS_QUERY_KEY);
      const readAt = new Date().toISOString();

      queryClient.setQueryData<NotificationItem[]>(
        NOTIFICATIONS_QUERY_KEY,
        (currentNotifications = []) =>
          currentNotifications.map((notification) =>
            notification.readAt
              ? notification
              : { ...notification, readAt },
          ),
      );

      return { previousNotifications };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousNotifications) {
        queryClient.setQueryData(
          NOTIFICATIONS_QUERY_KEY,
          context.previousNotifications,
        );
      }
    },
    onSettled: invalidateNotifications,
  });

  const unreadNotifications = useMemo(
    () => notifications.filter((notification) => !notification.readAt),
    [notifications],
  );

  const hasUnread = unreadNotifications.length > 0;

  const markAsRead = useCallback((id: string) => {
    markNotification({ id, read: true });
  }, [markNotification]);

  const markAsUnread = useCallback((id: string) => {
    markNotification({ id, read: false });
  }, [markNotification]);

  const markAllAsRead = useCallback(() => {
    markAllNotifications();
  }, [markAllNotifications]);

  const isRead = useCallback(
    (id: string) =>
      Boolean(notifications.find((notification) => notification.id === id)?.readAt),
    [notifications],
  );

  return {
    notifications,
    unreadNotifications,
    readIds: notifications
      .filter((notification) => notification.readAt)
      .map((notification) => notification.id),
    isLoading,
    isStorageReady: true,
    hasUnread,
    isRead,
    markAsRead,
    markAsUnread,
    markAllAsRead,
  };
};
