"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { fetcher } from "@/lib/fetcher";
import { NotificationItem } from "@/components/notifications/types";

const READ_STORAGE_KEY = "read-notifications";
const READ_IDS_CHANGED_EVENT = "bkflow:read-notifications-changed";

const readStoredIds = () => {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const stored = window.localStorage.getItem(READ_STORAGE_KEY);
    return stored ? JSON.parse(stored) as string[] : [];
  } catch {
    return [];
  }
};

const writeStoredIds = (ids: string[]) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(READ_STORAGE_KEY, JSON.stringify(ids));
  window.setTimeout(() => {
    window.dispatchEvent(new Event(READ_IDS_CHANGED_EVENT));
  }, 0);
};

export const useNotifications = () => {
  const [readIds, setReadIds] = useState<string[]>([]);
  const [isStorageReady, setIsStorageReady] = useState(false);

  useEffect(() => {
    const hydrateTimer = window.setTimeout(() => {
      setReadIds(readStoredIds());
      setIsStorageReady(true);
    }, 0);

    const syncReadIds = () => {
      setReadIds(readStoredIds());
    };

    window.addEventListener("storage", syncReadIds);
    window.addEventListener(READ_IDS_CHANGED_EVENT, syncReadIds);

    return () => {
      window.clearTimeout(hydrateTimer);
      window.removeEventListener("storage", syncReadIds);
      window.removeEventListener(READ_IDS_CHANGED_EVENT, syncReadIds);
    };
  }, []);

  const { data: notifications = [], isLoading } = useQuery<NotificationItem[]>({
    queryKey: ["notifications"],
    queryFn: () => fetcher("/api/notifications"),
    refetchInterval: 30000,
  });

  const readIdSet = useMemo(() => new Set(readIds), [readIds]);

  const unreadNotifications = useMemo(
    () => notifications.filter((notification) => !readIdSet.has(notification.id)),
    [notifications, readIdSet],
  );

  const hasUnread = unreadNotifications.length > 0;

  const setStoredReadIds = useCallback((updater: (ids: string[]) => string[]) => {
    setReadIds((currentIds) => {
      const nextIds = Array.from(new Set(updater(currentIds)));
      writeStoredIds(nextIds);
      return nextIds;
    });
  }, []);

  const markAsRead = useCallback((id: string) => {
    setStoredReadIds((currentIds) => (
      currentIds.includes(id) ? currentIds : [...currentIds, id]
    ));
  }, [setStoredReadIds]);

  const markAsUnread = useCallback((id: string) => {
    setStoredReadIds((currentIds) => currentIds.filter((readId) => readId !== id));
  }, [setStoredReadIds]);

  const markAllAsRead = useCallback(() => {
    setStoredReadIds((currentIds) => [
      ...currentIds,
      ...notifications.map((notification) => notification.id),
    ]);
  }, [notifications, setStoredReadIds]);

  const isRead = useCallback((id: string) => readIdSet.has(id), [readIdSet]);

  return {
    notifications,
    unreadNotifications,
    readIds,
    isLoading,
    isStorageReady,
    hasUnread,
    isRead,
    markAsRead,
    markAsUnread,
    markAllAsRead,
  };
};
