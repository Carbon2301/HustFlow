"use client";

import { useRealtimeChannel } from "@/hooks/use-realtime-channel";
import type { RealtimeChannelName } from "@/lib/realtime/channels";
import type {
  RealtimeEventHandler,
  RealtimeEventName,
} from "@/lib/realtime/events";

import {
  BOARD_CALENDAR_ACCESS_REVOKE_EVENTS,
  BOARD_CALENDAR_DELETE_EVENTS,
  BOARD_CALENDAR_INVALIDATE_EVENTS,
  BOARD_CALENDAR_REFRESH_EVENTS,
} from "../../_lib/realtime";

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

type BoardCalendarInvalidateEvent =
  (typeof BOARD_CALENDAR_INVALIDATE_EVENTS)[number];
type BoardCalendarRefreshEvent =
  (typeof BOARD_CALENDAR_REFRESH_EVENTS)[number];
type BoardCalendarAccessRevokeEvent =
  (typeof BOARD_CALENDAR_ACCESS_REVOKE_EVENTS)[number];
type BoardCalendarDeleteEvent =
  (typeof BOARD_CALENDAR_DELETE_EVENTS)[number];

type BoardCalendarRealtimeSubscriptionsProps = {
  channelName: RealtimeChannelName;
  enabled: boolean;
  onInvalidate: RealtimeEventHandler<BoardCalendarInvalidateEvent>;
  onRefresh: RealtimeEventHandler<BoardCalendarRefreshEvent>;
  onBoardDeleted: RealtimeEventHandler<BoardCalendarDeleteEvent>;
  onAccessRevoked: RealtimeEventHandler<BoardCalendarAccessRevokeEvent>;
};

export const BoardCalendarRealtimeSubscriptions = ({
  channelName,
  enabled,
  onInvalidate,
  onRefresh,
  onBoardDeleted,
  onAccessRevoked,
}: BoardCalendarRealtimeSubscriptionsProps) => (
  <>
    {BOARD_CALENDAR_INVALIDATE_EVENTS.map((event) => (
      <RealtimeSubscription
        key={event}
        channelName={channelName}
        event={event}
        enabled={enabled}
        onEvent={onInvalidate}
      />
    ))}
    {BOARD_CALENDAR_REFRESH_EVENTS.map((event) => (
      <RealtimeSubscription
        key={event}
        channelName={channelName}
        event={event}
        enabled={enabled}
        onEvent={onRefresh}
      />
    ))}
    {BOARD_CALENDAR_ACCESS_REVOKE_EVENTS.map((event) => (
      <RealtimeSubscription
        key={event}
        channelName={channelName}
        event={event}
        enabled={enabled}
        onEvent={onAccessRevoked}
      />
    ))}
    {BOARD_CALENDAR_DELETE_EVENTS.map((event) => (
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
