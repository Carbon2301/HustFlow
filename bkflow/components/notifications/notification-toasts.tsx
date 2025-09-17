"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { Bell, Clock, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { useCardModal } from "@/hooks/use-card-modal";
import { useNotifications } from "@/hooks/use-notifications";
import { NotificationItem } from "@/components/notifications/types";

const SHOWN_STORAGE_KEY = "shown-notification-toasts";
const AUTO_DISMISS_MS = 5600;
const EXIT_ANIMATION_MS = 180;
const MAX_VISIBLE_TOASTS = 3;

type ToastState = "entering" | "visible" | "exiting";

type NotificationToast = {
  item: NotificationItem;
  state: ToastState;
};

const readShownIds = () => {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const stored = window.localStorage.getItem(SHOWN_STORAGE_KEY);
    return stored ? JSON.parse(stored) as string[] : [];
  } catch {
    return [];
  }
};

const writeShownIds = (ids: string[]) => {
  window.localStorage.setItem(SHOWN_STORAGE_KEY, JSON.stringify(ids));
};

const formatNotificationTime = (date: string) => {
  try {
    return format(new Date(date), "HH:mm", { locale: vi });
  } catch {
    return "";
  }
};

export const NotificationToasts = () => {
  const cardModal = useCardModal();
  const {
    unreadNotifications,
    isStorageReady,
    isRead,
    markAsRead,
  } = useNotifications();
  const [toasts, setToasts] = useState<NotificationToast[]>([]);
  const shownIdsRef = useRef<Set<string>>(new Set());
  const closeTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const removeTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const isShownStorageReadyRef = useRef(false);

  useEffect(() => {
    shownIdsRef.current = new Set(readShownIds());
    isShownStorageReadyRef.current = true;
  }, []);

  const persistShownIds = useCallback(() => {
    writeShownIds(Array.from(shownIdsRef.current));
  }, []);

  const clearTimers = useCallback((id: string) => {
    const closeTimer = closeTimersRef.current.get(id);
    const removeTimer = removeTimersRef.current.get(id);
    const enterTimer = removeTimersRef.current.get(`enter-${id}`);

    if (closeTimer) {
      clearTimeout(closeTimer);
      closeTimersRef.current.delete(id);
    }

    if (removeTimer) {
      clearTimeout(removeTimer);
      removeTimersRef.current.delete(id);
    }

    if (enterTimer) {
      clearTimeout(enterTimer);
      removeTimersRef.current.delete(`enter-${id}`);
    }
  }, []);

  const dismissToast = useCallback((id: string) => {
    clearTimers(id);

    setToasts((currentToasts) =>
      currentToasts.map((toast) =>
        toast.item.id === id
          ? { ...toast, state: "exiting" }
          : toast
      )
    );

    const removeTimer = setTimeout(() => {
      setToasts((currentToasts) =>
        currentToasts.filter((toast) => toast.item.id !== id)
      );
      removeTimersRef.current.delete(id);
    }, EXIT_ANIMATION_MS);

    removeTimersRef.current.set(id, removeTimer);
  }, [clearTimers]);

  const scheduleToast = useCallback((id: string) => {
    const enterTimer = setTimeout(() => {
      setToasts((currentToasts) =>
        currentToasts.map((toast) =>
          toast.item.id === id
            ? { ...toast, state: "visible" }
            : toast
        )
      );
    }, 20);

    const closeTimer = setTimeout(() => {
      dismissToast(id);
    }, AUTO_DISMISS_MS);

    removeTimersRef.current.set(`enter-${id}`, enterTimer);
    closeTimersRef.current.set(id, closeTimer);
  }, [dismissToast]);

  useEffect(() => {
    if (!isStorageReady || !isShownStorageReadyRef.current) {
      return;
    }

    const openSlots = Math.max(0, MAX_VISIBLE_TOASTS - toasts.length);

    if (openSlots === 0) {
      return;
    }

    const activeIds = new Set(toasts.map((toast) => toast.item.id));
    const nextItems = unreadNotifications
      .filter((notification) => !shownIdsRef.current.has(notification.id))
      .filter((notification) => !activeIds.has(notification.id))
      .slice(0, openSlots);

    if (nextItems.length === 0) {
      return;
    }

    nextItems.forEach((notification) => shownIdsRef.current.add(notification.id));
    persistShownIds();

    setToasts((currentToasts) => {
      const mergedToasts = [
        ...nextItems.map((item) => ({ item, state: "entering" as ToastState })),
        ...currentToasts,
      ];

      return mergedToasts.slice(0, MAX_VISIBLE_TOASTS);
    });

    nextItems.forEach((notification) => scheduleToast(notification.id));
  }, [
    isStorageReady,
    persistShownIds,
    scheduleToast,
    toasts,
    unreadNotifications,
  ]);

  useEffect(() => {
    const syncTimer = window.setTimeout(() => {
      setToasts((currentToasts) =>
        currentToasts.filter((toast) => {
          const shouldKeep = !isRead(toast.item.id);

          if (!shouldKeep) {
            clearTimers(toast.item.id);
          }

          return shouldKeep;
        })
      );
    }, 0);

    return () => window.clearTimeout(syncTimer);
  }, [clearTimers, isRead]);

  useEffect(() => {
    const closeTimers = closeTimersRef.current;
    const removeTimers = removeTimersRef.current;

    return () => {
      closeTimers.forEach((timer) => clearTimeout(timer));
      removeTimers.forEach((timer) => clearTimeout(timer));
      closeTimers.clear();
      removeTimers.clear();
    };
  }, []);

  const visibleToasts = useMemo(() => toasts.slice(0, MAX_VISIBLE_TOASTS), [toasts]);

  const openCard = (notification: NotificationItem) => {
    markAsRead(notification.id);
    dismissToast(notification.id);
    cardModal.onOpen(notification.cardId);
  };

  if (visibleToasts.length === 0) {
    return null;
  }

  return (
    <div className="fixed right-4 top-16 z-[60] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-3 pointer-events-none">
      {visibleToasts.map((toast) => (
        <div
          key={toast.item.id}
          role="button"
          tabIndex={0}
          onClick={() => openCard(toast.item)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              openCard(toast.item);
            }
          }}
          className={cn(
            "pointer-events-auto group overflow-hidden rounded-xl border border-violet-100 bg-white/95 p-4 shadow-2xl shadow-slate-900/12 backdrop-blur-sm outline-none transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-violet-950/15 focus-visible:ring-2 focus-visible:ring-violet-300",
            toast.state === "visible"
              ? "translate-x-0 opacity-100"
              : "translate-x-4 opacity-0",
          )}
        >
          <div className="flex items-start gap-x-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
              <Bell className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-x-3">
                <p className="text-sm font-bold text-slate-900">Sắp đến hạn</p>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    dismissToast(toast.item.id);
                  }}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Đóng thông báo"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-1 text-sm leading-snug text-slate-600">
                Task{" "}
                <span className="font-semibold text-slate-900">
                  &quot;{toast.item.cardTitle}&quot;
                </span>{" "}
                sẽ hết hạn lúc {formatNotificationTime(toast.item.dueDate)}
              </p>
              <div className="mt-2 flex items-center gap-x-1.5 text-xs font-medium text-violet-600">
                <Clock className="h-3.5 w-3.5" />
                <span className="truncate">
                  {toast.item.boardTitle} / {toast.item.listTitle}
                </span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
