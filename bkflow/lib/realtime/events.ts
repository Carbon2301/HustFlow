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
  CARD_MEMBER_ASSIGNED: "card.member.assigned",
  CARD_MEMBER_UNASSIGNED: "card.member.unassigned",
  CARD_UPDATED: "card.updated",
  CARD_MOVED: "card.moved",
  CARD_REORDERED: "card.reordered",
  CARD_CREATED: "card.created",
  CARD_DELETED: "card.deleted",
  CARD_COMMENT_COUNT_UPDATED: "card.comment.count.updated",
  MEMBER_UPDATED: "member.updated",
  BOARD_UPDATED: "board.updated",
  BOARD_DELETED: "board.deleted",
  BOARD_ACCESS_REVOKED: "board.access.revoked",
  BOARD_MEMBER_ADDED: "board.member.added",
  BOARD_MEMBER_REMOVED: "board.member.removed",
  BOARD_MEMBER_ROLE_UPDATED: "board.member.role.updated",
  LIST_CREATED: "list.created",
  LIST_UPDATED: "list.updated",
  LIST_DELETED: "list.deleted",
  LIST_REORDERED: "list.reordered",
  CHECKLIST_CREATED: "checklist.created",
  CHECKLIST_UPDATED: "checklist.updated",
  CHECKLIST_DELETED: "checklist.deleted",
  CHECKLIST_ITEM_CREATED: "checklist-item.created",
  CHECKLIST_ITEM_UPDATED: "checklist-item.updated",
  CHECKLIST_ITEM_DELETED: "checklist-item.deleted",
  CHECKLIST_ITEM_TOGGLED: "checklist-item.toggled",
  CHECKLIST_ITEM_ASSIGNEE_UPDATED: "checklist-item.assignee-updated",
  CHECKLIST_ITEM_DUE_DATE_UPDATED: "checklist-item.due-date-updated",
  CHECKLIST_ITEM_REORDERED: "checklist-item.reordered",
  CHECKLIST_ITEM_MOVED: "checklist-item.moved",
  LABEL_CREATED: "label.created",
  LABEL_UPDATED: "label.updated",
  LABEL_DELETED: "label.deleted",
  CARD_LABEL_ATTACHED: "card-label.attached",
  CARD_LABEL_DETACHED: "card-label.detached",
} as const;

export type RealtimeEventName =
  (typeof REALTIME_EVENTS)[keyof typeof REALTIME_EVENTS];

export type RealtimeEventPayload<TEvent extends RealtimeEventName> =
  RealtimeEventPayloads[TEvent];

export type RealtimeEventHandler<TEvent extends RealtimeEventName> = (
  payload: RealtimeEventPayload<TEvent>,
) => void;
