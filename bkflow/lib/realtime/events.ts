import type { RealtimeEventPayloads } from "@/lib/realtime/types";

export const REALTIME_EVENTS = {
  NOTIFICATION_CREATED: "notification.created",
  COMMENT_CREATED: "comment.created",
  COMMENT_UPDATED: "comment.updated",
  COMMENT_DELETED: "comment.deleted",
  REACTION_CREATED: "reaction.created",
  REACTION_UPDATED: "reaction.updated",
  REACTION_DELETED: "reaction.deleted",
  CARD_ASSIGNED: "card.assigned",
  CARD_UPDATED: "card.updated",
  CARD_MOVED: "card.moved",
  MEMBER_UPDATED: "member.updated",
  BOARD_UPDATED: "board.updated",
} as const;

export type RealtimeEventName =
  (typeof REALTIME_EVENTS)[keyof typeof REALTIME_EVENTS];

export type RealtimeEventPayload<TEvent extends RealtimeEventName> =
  RealtimeEventPayloads[TEvent];

export type RealtimeEventHandler<TEvent extends RealtimeEventName> = (
  payload: RealtimeEventPayload<TEvent>,
) => void;
