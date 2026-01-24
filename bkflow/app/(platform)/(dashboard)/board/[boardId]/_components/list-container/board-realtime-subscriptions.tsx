"use client";

import { useRealtimeChannel } from "@/hooks/use-realtime-channel";
import type { RealtimeChannelName } from "@/lib/realtime/channels";
import { REALTIME_EVENTS } from "@/lib/realtime/events";
import type {
  AttachmentReorderedPayload,
  BoardAccessRevokedPayload,
  BoardDeletedPayload,
  BoardMemberRemovedPayload,
  CardCommentCountUpdatedPayload,
  CardDeletedPayload,
  CardLabelPayload,
  ChecklistItemMovedPayload,
  ChecklistItemPayload,
  ChecklistItemReorderedPayload,
  ChecklistPayload,
  LabelPayload,
} from "@/lib/realtime/types";
import type { RealtimeEventName, RealtimeEventPayload } from "@/lib/realtime/events";

type BoardCardSyncPayload =
  | RealtimeEventPayload<typeof REALTIME_EVENTS.BOARD_UPDATED>
  | RealtimeEventPayload<typeof REALTIME_EVENTS.CARD_UPDATED>
  | RealtimeEventPayload<typeof REALTIME_EVENTS.CARD_REORDERED>
  | RealtimeEventPayload<typeof REALTIME_EVENTS.CARD_MOVED>
  | RealtimeEventPayload<typeof REALTIME_EVENTS.CARD_MEMBER_ASSIGNED>
  | RealtimeEventPayload<typeof REALTIME_EVENTS.CARD_MEMBER_UNASSIGNED>
  | RealtimeEventPayload<typeof REALTIME_EVENTS.BOARD_MEMBER_ADDED>
  | RealtimeEventPayload<typeof REALTIME_EVENTS.BOARD_MEMBER_ROLE_UPDATED>
  | RealtimeEventPayload<typeof REALTIME_EVENTS.LIST_CREATED>
  | RealtimeEventPayload<typeof REALTIME_EVENTS.LIST_UPDATED>
  | RealtimeEventPayload<typeof REALTIME_EVENTS.LIST_DELETED>
  | RealtimeEventPayload<typeof REALTIME_EVENTS.LIST_REORDERED>
  | RealtimeEventPayload<typeof REALTIME_EVENTS.CARD_CREATED>;

type ChecklistSyncPayload =
  | ChecklistPayload
  | ChecklistItemPayload
  | ChecklistItemReorderedPayload
  | ChecklistItemMovedPayload;

type LabelSyncPayload = LabelPayload | CardLabelPayload;

type BoardRealtimeSubscriptionsProps = {
  channelName: RealtimeChannelName;
  enabled: boolean;
  onBoardCardSync: (payload: BoardCardSyncPayload) => void;
  onBoardDeleted: (payload: BoardDeletedPayload) => void;
  onAccessRevoked: (payload: BoardAccessRevokedPayload) => void;
  onBoardMemberRemoved: (payload: BoardMemberRemovedPayload) => void;
  onCardDeleted: (payload: CardDeletedPayload) => void;
  onChecklistSync: (payload: ChecklistSyncPayload) => void;
  onLabelSync: (payload: LabelSyncPayload) => void;
  onAttachmentReordered: (payload: AttachmentReorderedPayload) => void;
  onCommentCountUpdated: (payload: CardCommentCountUpdatedPayload) => void;
};

type RealtimeSubscriptionProps<TEvent extends RealtimeEventName> = {
  channelName: RealtimeChannelName;
  enabled: boolean;
  event: TEvent;
  onEvent: (payload: RealtimeEventPayload<TEvent>) => void;
};

const RealtimeSubscription = <TEvent extends RealtimeEventName>({
  channelName,
  enabled,
  event,
  onEvent,
}: RealtimeSubscriptionProps<TEvent>) => {
  useRealtimeChannel({
    channelName,
    event,
    onEvent,
    enabled,
  });

  return null;
};

const boardCardSyncEvents = [
  REALTIME_EVENTS.BOARD_UPDATED,
  REALTIME_EVENTS.CARD_UPDATED,
  REALTIME_EVENTS.CARD_REORDERED,
  REALTIME_EVENTS.CARD_MOVED,
  REALTIME_EVENTS.CARD_MEMBER_ASSIGNED,
  REALTIME_EVENTS.CARD_MEMBER_UNASSIGNED,
  REALTIME_EVENTS.BOARD_MEMBER_ADDED,
  REALTIME_EVENTS.BOARD_MEMBER_ROLE_UPDATED,
  REALTIME_EVENTS.LIST_CREATED,
  REALTIME_EVENTS.LIST_UPDATED,
  REALTIME_EVENTS.LIST_DELETED,
  REALTIME_EVENTS.LIST_REORDERED,
  REALTIME_EVENTS.CARD_CREATED,
] as const;

const checklistSyncEvents = [
  REALTIME_EVENTS.CHECKLIST_CREATED,
  REALTIME_EVENTS.CHECKLIST_UPDATED,
  REALTIME_EVENTS.CHECKLIST_DELETED,
  REALTIME_EVENTS.CHECKLIST_ITEM_CREATED,
  REALTIME_EVENTS.CHECKLIST_ITEM_UPDATED,
  REALTIME_EVENTS.CHECKLIST_ITEM_DELETED,
  REALTIME_EVENTS.CHECKLIST_ITEM_TOGGLED,
  REALTIME_EVENTS.CHECKLIST_ITEM_ASSIGNEE_UPDATED,
  REALTIME_EVENTS.CHECKLIST_ITEM_DUE_DATE_UPDATED,
  REALTIME_EVENTS.CHECKLIST_ITEM_REORDERED,
  REALTIME_EVENTS.CHECKLIST_ITEM_MOVED,
] as const;

const labelSyncEvents = [
  REALTIME_EVENTS.LABEL_CREATED,
  REALTIME_EVENTS.LABEL_UPDATED,
  REALTIME_EVENTS.LABEL_DELETED,
  REALTIME_EVENTS.CARD_LABEL_ATTACHED,
  REALTIME_EVENTS.CARD_LABEL_DETACHED,
] as const;

export const BoardRealtimeSubscriptions = ({
  channelName,
  enabled,
  onBoardCardSync,
  onBoardDeleted,
  onAccessRevoked,
  onBoardMemberRemoved,
  onCardDeleted,
  onChecklistSync,
  onLabelSync,
  onAttachmentReordered,
  onCommentCountUpdated,
}: BoardRealtimeSubscriptionsProps) => (
  <>
    <RealtimeSubscription
      channelName={channelName}
      event={REALTIME_EVENTS.CARD_COMMENT_COUNT_UPDATED}
      onEvent={onCommentCountUpdated}
      enabled={enabled}
    />
    {boardCardSyncEvents.map((event) => (
      <RealtimeSubscription
        key={event}
        channelName={channelName}
        event={event}
        onEvent={onBoardCardSync}
        enabled={enabled}
      />
    ))}
    <RealtimeSubscription
      channelName={channelName}
      event={REALTIME_EVENTS.BOARD_DELETED}
      onEvent={onBoardDeleted}
      enabled={enabled}
    />
    <RealtimeSubscription
      channelName={channelName}
      event={REALTIME_EVENTS.BOARD_ACCESS_REVOKED}
      onEvent={onAccessRevoked}
      enabled={enabled}
    />
    <RealtimeSubscription
      channelName={channelName}
      event={REALTIME_EVENTS.BOARD_MEMBER_REMOVED}
      onEvent={onBoardMemberRemoved}
      enabled={enabled}
    />
    <RealtimeSubscription
      channelName={channelName}
      event={REALTIME_EVENTS.CARD_DELETED}
      onEvent={onCardDeleted}
      enabled={enabled}
    />
    {checklistSyncEvents.map((event) => (
      <RealtimeSubscription
        key={event}
        channelName={channelName}
        event={event}
        onEvent={onChecklistSync}
        enabled={enabled}
      />
    ))}
    {labelSyncEvents.map((event) => (
      <RealtimeSubscription
        key={event}
        channelName={channelName}
        event={event}
        onEvent={onLabelSync}
        enabled={enabled}
      />
    ))}
    <RealtimeSubscription
      channelName={channelName}
      event={REALTIME_EVENTS.ATTACHMENT_REORDERED}
      onEvent={onAttachmentReordered}
      enabled={enabled}
    />
  </>
);
