"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import type { RealtimeChannelName } from "@/lib/realtime/channels";
import {
  bindRealtimeEvent,
  subscribeRealtimeChannel,
  unsubscribeRealtimeChannel,
} from "@/lib/realtime/client";
import type {
  RealtimeEventHandler,
  RealtimeEventName,
} from "@/lib/realtime/events";
import type { RealtimeQueryInvalidation } from "@/lib/realtime/types";

export const useRealtimeChannel = <TEvent extends RealtimeEventName>({
  channelName,
  event,
  onEvent,
  enabled = true,
}: {
  channelName: RealtimeChannelName | null | undefined;
  event: TEvent;
  onEvent: RealtimeEventHandler<TEvent>;
  enabled?: boolean;
}) => {
  useEffect(() => {
    if (!enabled || !channelName) {
      return;
    }

    const channel = subscribeRealtimeChannel(channelName);
    const unbind = bindRealtimeEvent(channel, event, onEvent);

    return () => {
      unbind();
      unsubscribeRealtimeChannel(channelName);
    };
  }, [channelName, enabled, event, onEvent]);
};

export const useRealtimeInvalidation = () => {
  const queryClient = useQueryClient();

  return (invalidations: RealtimeQueryInvalidation[]) => {
    invalidations.forEach(({ queryKey }) => {
      queryClient.invalidateQueries({ queryKey });
    });
  };
};
