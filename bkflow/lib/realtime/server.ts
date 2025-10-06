import "server-only";

import Pusher from "pusher";

import type { RealtimeChannelName } from "@/lib/realtime/channels";
import type {
  RealtimeEventName,
  RealtimeEventPayload,
} from "@/lib/realtime/events";

type ServerPusherConfig = {
  appId: string;
  key: string;
  secret: string;
  cluster: string;
};

let serverPusher: Pusher | null = null;

const readServerPusherConfig = (): ServerPusherConfig => {
  const config = {
    appId: process.env.PUSHER_APP_ID,
    key: process.env.PUSHER_KEY,
    secret: process.env.PUSHER_SECRET,
    cluster: process.env.PUSHER_CLUSTER,
  };

  const missing = Object.entries(config)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(
      `Missing Pusher server environment variables: ${missing.join(", ")}`,
    );
  }

  return config as ServerPusherConfig;
};

export const getServerPusher = () => {
  if (serverPusher) {
    return serverPusher;
  }

  const config = readServerPusherConfig();

  serverPusher = new Pusher({
    appId: config.appId,
    key: config.key,
    secret: config.secret,
    cluster: config.cluster,
    useTLS: true,
  });

  return serverPusher;
};

export const triggerRealtimeEvent = async <TEvent extends RealtimeEventName>({
  channel,
  event,
  payload,
}: {
  channel: RealtimeChannelName;
  event: TEvent;
  payload: RealtimeEventPayload<TEvent>;
}) => {
  await getServerPusher().trigger(channel, event, payload);
};
