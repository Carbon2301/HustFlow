"use client";

import Pusher, { Channel } from "pusher-js";

import type { RealtimeChannelName } from "@/lib/realtime/channels";
import type {
  RealtimeEventHandler,
  RealtimeEventName,
} from "@/lib/realtime/events";

type ClientPusherConfig = {
  key: string;
  cluster: string;
};

const channelRefs = new Map<string, number>();
let clientPusher: Pusher | null = null;

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
  const currentRefs = channelRefs.get(channelName) ?? 0;

  channelRefs.set(channelName, currentRefs + 1);

  const existingChannel = pusher.channel(channelName);

  if (existingChannel) {
    return existingChannel;
  }

  return pusher.subscribe(channelName);
};

export const unsubscribeRealtimeChannel = (
  channelName: RealtimeChannelName,
) => {
  const pusher = getClientPusher();
  const currentRefs = channelRefs.get(channelName) ?? 0;
  const nextRefs = Math.max(currentRefs - 1, 0);

  if (nextRefs > 0) {
    channelRefs.set(channelName, nextRefs);
    return;
  }

  channelRefs.delete(channelName);
  pusher.unsubscribe(channelName);
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
