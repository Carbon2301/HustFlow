"use client";

import { useRealtimeChannel } from "@/hooks/use-realtime-channel";
import type { RealtimeChannelName } from "@/lib/realtime/channels";
import type {
  RealtimeEventHandler,
  RealtimeEventName,
} from "@/lib/realtime/events";

import {
  TIMELINE_ACCESS_REVOKE_EVENTS,
  TIMELINE_BOARD_DELETE_EVENTS,
  TIMELINE_REFRESH_EVENTS,
} from "./realtime";

type RealtimeSubscriptionProps<TEvent extends RealtimeEventName> = {
  channelName: RealtimeChannelName;
  event: TEvent;
  enabled: boolean;
  onEvent: RealtimeEventHandler<TEvent>;
};

const RealtimeSubscription = <TEvent extends RealtimeEventName>({
  channelName,
  event,
  enabled,
  onEvent,
}: RealtimeSubscriptionProps<TEvent>) => {
  useRealtimeChannel({
    channelName,
    event,
    enabled,
    onEvent,
  });

  return null;
};

type TimelineRefreshEvent = (typeof TIMELINE_REFRESH_EVENTS)[number];
type TimelineAccessRevokeEvent = (typeof TIMELINE_ACCESS_REVOKE_EVENTS)[number];
type TimelineBoardDeleteEvent = (typeof TIMELINE_BOARD_DELETE_EVENTS)[number];

type BoardTimelineRealtimeSubscriptionsProps = {
  channelName: RealtimeChannelName;
  enabled: boolean;
  onRefresh: RealtimeEventHandler<TimelineRefreshEvent>;
  onAccessRevoked: RealtimeEventHandler<TimelineAccessRevokeEvent>;
  onBoardDeleted: RealtimeEventHandler<TimelineBoardDeleteEvent>;
};

export const BoardTimelineRealtimeSubscriptions = ({
  channelName,
  enabled,
  onRefresh,
  onAccessRevoked,
  onBoardDeleted,
}: BoardTimelineRealtimeSubscriptionsProps) => (
  <>
    {TIMELINE_REFRESH_EVENTS.map((event) => (
      <RealtimeSubscription
        key={event}
        channelName={channelName}
        event={event}
        enabled={enabled}
        onEvent={onRefresh}
      />
    ))}
    {TIMELINE_ACCESS_REVOKE_EVENTS.map((event) => (
      <RealtimeSubscription
        key={event}
        channelName={channelName}
        event={event}
        enabled={enabled}
        onEvent={onAccessRevoked}
      />
    ))}
    {TIMELINE_BOARD_DELETE_EVENTS.map((event) => (
      <RealtimeSubscription
        key={event}
        channelName={channelName}
        event={event}
        enabled={enabled}
        onEvent={onBoardDeleted}
      />
    ))}
  </>
);
