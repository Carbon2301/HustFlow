"use client";

import Pusher, { Channel } from "pusher-js";

import type { RealtimeChannelName } from "@/lib/realtime/channels";
import { debugBoardRealtime } from "@/lib/realtime/debug";
import type {
  RealtimeEventHandler,
  RealtimeEventName,
} from "@/lib/realtime/events";

type ClientPusherConfig = {
  key: string;
  cluster: string;
};

type ChannelState = {
  refs: number;
  generation: number;
  lastRecoveryAt: number;
};

const channelStates = new Map<string, ChannelState>();
const channelRecoveryListeners = new Map<string, Set<() => void>>();
let clientPusher: Pusher | null = null;

const shouldDebugChannel = (channelName: string) =>
  channelName.startsWith("private-board-");

export const isRealtimeClientConfigured = () =>
  Boolean(
    process.env.NEXT_PUBLIC_PUSHER_KEY &&
      process.env.NEXT_PUBLIC_PUSHER_CLUSTER,
  );

const readClientPusherConfig = (): ClientPusherConfig => {
  const config = {
    key: process.env.NEXT_PUBLIC_PUSHER_KEY,
    cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER,
  };

  const missing = Object.entries(config)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(
      `Missing Pusher client environment variables: ${missing.join(", ")}`,
    );
  }

  return config as ClientPusherConfig;
};

export const getClientPusher = () => {
  if (clientPusher) {
    return clientPusher;
  }

  const config = readClientPusherConfig();

  clientPusher = new Pusher(config.key, {
    cluster: config.cluster,
    channelAuthorization: {
      endpoint: "/api/pusher/auth",
      transport: "ajax",
    },
  });

  return clientPusher;
};

export const subscribeRealtimeChannel = (
  channelName: RealtimeChannelName,
): Channel => {
  const pusher = getClientPusher();
  const state = channelStates.get(channelName) ?? {
    refs: 0,
    generation: 0,
    lastRecoveryAt: 0,
  };

  state.refs += 1;
  channelStates.set(channelName, state);

  const existingChannel = pusher.channel(channelName);

  if (existingChannel) {
    return existingChannel;
  }

  if (shouldDebugChannel(channelName)) {
    debugBoardRealtime("subscribing channel", {
      channelName,
    });
  }

  const channel = pusher.subscribe(channelName);

  if (shouldDebugChannel(channelName)) {
    channel.bind("pusher:subscription_succeeded", () => {
      debugBoardRealtime("subscribed success", {
        channelName,
      });
    });

    channel.bind("pusher:subscription_error", (error: unknown) => {
      const status =
        error && typeof error === "object" && "status" in error
          ? String((error as { status?: unknown }).status)
          : undefined;

      debugBoardRealtime("subscription error/auth error", {
        channelName,
        status,
      });
    });
  }

  return channel;
};

export const unsubscribeRealtimeChannel = (
  channelName: RealtimeChannelName,
) => {
  const pusher = getClientPusher();
  const state = channelStates.get(channelName);

  if (!state) {
    return;
  }

  const currentRefs = state.refs;
  const nextRefs = Math.max(currentRefs - 1, 0);

  if (nextRefs > 0) {
    state.refs = nextRefs;
    channelStates.set(channelName, state);
    return;
  }

  channelStates.delete(channelName);
  if (shouldDebugChannel(channelName)) {
    debugBoardRealtime("unsubscribed channel", {
      channelName,
    });
  }
  pusher.unsubscribe(channelName);
};

export const recoverRealtimeChannel = (
  channelName: RealtimeChannelName,
  reason: string,
) => {
  const pusher = getClientPusher();
  const state = channelStates.get(channelName) ?? {
    refs: 0,
    generation: 0,
    lastRecoveryAt: 0,
  };
  const now = Date.now();

  if (now - state.lastRecoveryAt < 500) {
    return false;
  }

  state.generation += 1;
  state.refs = 0;
  state.lastRecoveryAt = now;
  channelStates.set(channelName, state);

  if (shouldDebugChannel(channelName)) {
    debugBoardRealtime("unsubscribed channel", {
      channelName,
      reason,
    });
  }

  pusher.unsubscribe(channelName);
  channelRecoveryListeners.get(channelName)?.forEach((listener) => {
    listener();
  });

  return true;
};

export const onRealtimeChannelRecovered = (
  channelName: RealtimeChannelName,
  listener: () => void,
) => {
  const listeners = channelRecoveryListeners.get(channelName) ?? new Set<() => void>();

  listeners.add(listener);
  channelRecoveryListeners.set(channelName, listeners);

  return () => {
    listeners.delete(listener);

    if (listeners.size === 0) {
      channelRecoveryListeners.delete(channelName);
    }
  };
};

export const bindRealtimeEvent = <TEvent extends RealtimeEventName>(
  channel: Channel,
  event: TEvent,
  handler: RealtimeEventHandler<TEvent>,
) => {
  channel.bind(event, handler);

  return () => {
    channel.unbind(event, handler);
  };
};
