"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import type { RealtimeChannelName } from "@/lib/realtime/channels";
import { debugBoardRealtime } from "@/lib/realtime/debug";
import {
  bindRealtimeEvent,
  onRealtimeChannelRecovered,
  recoverRealtimeChannel,
  subscribeRealtimeChannel,
  unsubscribeRealtimeChannel,
} from "@/lib/realtime/client";
import type {
  RealtimeEventHandler,
  RealtimeEventName,
} from "@/lib/realtime/events";
import type { RealtimeQueryInvalidation } from "@/lib/realtime/types";

const getRealtimeDebugDetails = (payload: unknown) => {
  if (!payload || typeof payload !== "object") {
    return {};
  }

  const data = payload as {
    boardId?: string;
    cardId?: string;
    listId?: string;
    eventId?: string;
  };

  return {
    boardId: data.boardId,
    cardId: data.cardId,
    listId: data.listId,
    eventId: data.eventId,
  };
};

export const useRealtimeChannel = <TEvent extends RealtimeEventName>({
  channelName,
  event,
  onEvent,
  onSubscribed,
  enabled = true,
}: {
  channelName: RealtimeChannelName | null | undefined;
  event: TEvent;
  onEvent: RealtimeEventHandler<TEvent>;
  onSubscribed?: () => void;
  enabled?: boolean;
}) => {
  const onEventRef = useRef(onEvent);
  const onSubscribedRef = useRef(onSubscribed);
  const [retryKey, setRetryKey] = useState(0);
  const shouldDebug = typeof channelName === "string" && channelName.startsWith("private-board-");
  const shouldMonitorSubscription = Boolean(onSubscribed);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    onSubscribedRef.current = onSubscribed;
  }, [onSubscribed]);

  useEffect(() => {
    if (!enabled || !channelName) {
      if (shouldDebug && channelName) {
        debugBoardRealtime("event ignored", {
          channelName,
          event,
          reason: "subscription disabled",
        });
      }

      return;
    }

    const channel = subscribeRealtimeChannel(channelName);
    const retrySubscription = (reason: string) => {
      recoverRealtimeChannel(channelName, reason);
    };
    const unbind = bindRealtimeEvent(channel, event, (payload) => {
      if (shouldDebug) {
        debugBoardRealtime("event received", {
          channelName,
          event,
          ...getRealtimeDebugDetails(payload),
        });
      }

      onEventRef.current(payload);
    });
    const handleSubscriptionError = (error: unknown) => {
      const status =
        error && typeof error === "object" && "status" in error
          ? String((error as { status?: unknown }).status)
          : undefined;

      debugBoardRealtime("subscription error/auth error", {
        channelName,
        event,
        status,
      });
      window.setTimeout(() => retrySubscription("subscription error/auth error"), 750);
    };
    const handleSubscriptionSucceeded = () => {
      onSubscribedRef.current?.();
    };
    const unlistenRecovery = onRealtimeChannelRecovered(channelName, () => {
      setRetryKey((current) => current + 1);
    });
    const subscriptionWatchdog = shouldMonitorSubscription
      ? window.setTimeout(() => {
      const subscribed = (channel as typeof channel & {
        subscribed?: boolean;
      }).subscribed;

      if (subscribed) {
        return;
      }

      debugBoardRealtime("event ignored", {
        channelName,
        event,
        reason: "subscription did not become ready",
      });
      retrySubscription("subscription did not become ready");
    }, 4000)
      : undefined;

    if (shouldMonitorSubscription) {
      channel.bind("pusher:subscription_error", handleSubscriptionError);
      channel.bind("pusher:subscription_succeeded", handleSubscriptionSucceeded);
    }

    if (shouldMonitorSubscription && (channel as typeof channel & { subscribed?: boolean }).subscribed) {
      window.setTimeout(handleSubscriptionSucceeded, 0);
    }

    if (shouldDebug) {
      debugBoardRealtime("event bound", {
        channelName,
        event,
      });
    }

    return () => {
      if (subscriptionWatchdog !== undefined) {
        window.clearTimeout(subscriptionWatchdog);
      }

      if (shouldMonitorSubscription) {
        channel.unbind("pusher:subscription_error", handleSubscriptionError);
        channel.unbind("pusher:subscription_succeeded", handleSubscriptionSucceeded);
      }

      unlistenRecovery();
      unbind();
      unsubscribeRealtimeChannel(channelName);
    };
  }, [channelName, enabled, event, retryKey, shouldDebug, shouldMonitorSubscription]);
};

export const useRealtimeInvalidation = () => {
  const queryClient = useQueryClient();

  return useCallback((invalidations: RealtimeQueryInvalidation[]) => {
    invalidations.forEach(({ queryKey }) => {
      queryClient.invalidateQueries({ queryKey });
    });
  }, [queryClient]);
};
