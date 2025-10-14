import type { BoardMemberRole, NOTIFICATION_TYPE } from "@prisma/client";

export type RealtimeActor = {
  userId: string;
  name: string;
  image: string | null;
};

export type RealtimeQueryInvalidation =
  | {
      queryKey: ["notifications"];
    }
  | {
      queryKey: ["card", string];
    }
  | {
      queryKey: ["card-logs", string];
    }
  | {
      queryKey: ["card-comments", string];
    };

export type CardUpdatedField =
  | "title"
  | "description"
  | "dueDate"
  | "isCompleted"
  | "reminder"
  | "reminderSetAt"
  | "assignees";

export type BoardUpdatedField = "title" | "members" | "roles";

export type NotificationCreatedPayload = {
  notificationId: string;
  orgId: string;
  recipientUserId: string;
  type: NOTIFICATION_TYPE;
  title: string;
  message: string;
  actor?: RealtimeActor | null;
  boardId?: string | null;
  cardId?: string | null;
  commentId?: string | null;
  createdAt: string;
  invalidate: RealtimeQueryInvalidation[];
};

export type CommentCreatedPayload = {
  eventId: string;
  boardId: string;
  cardId: string;
  commentId: string;
  parentId: string | null;
  actorUserId: string;
  createdAt: string;
  invalidate: RealtimeQueryInvalidation[];
};

export type CommentUpdatedPayload = {
  eventId: string;
  boardId: string;
  cardId: string;
  commentId: string;
  actorUserId: string;
  updatedAt: string;
  invalidate: RealtimeQueryInvalidation[];
};

export type CommentDeletedPayload = {
  eventId: string;
  boardId: string;
  cardId: string;
  commentId: string;
  actorUserId: string;
  deletedAt: string;
  invalidate: RealtimeQueryInvalidation[];
  deletedCount?: number;
};

export type CardCommentCountUpdatedPayload = {
  eventId: string;
  boardId: string;
  cardId: string;
  actorUserId: string;
  delta: number;
  updatedAt: string;
};

export type ReactionCreatedPayload = {
  eventId: string;
  boardId: string;
  cardId: string;
  commentId: string;
  reactionId: string;
  actorUserId: string;
  createdAt: string;
  invalidate: RealtimeQueryInvalidation[];
};

export type ReactionUpdatedPayload = {
  eventId: string;
  boardId: string;
  cardId: string;
  commentId: string;
  reactionId: string;
  actorUserId: string;
  emoji: string;
  updatedAt: string;
  invalidate: RealtimeQueryInvalidation[];
};

export type ReactionDeletedPayload = {
  eventId: string;
  boardId: string;
  cardId: string;
  commentId: string;
  reactionId: string;
  actorUserId: string;
  deletedAt: string;
  invalidate: RealtimeQueryInvalidation[];
};

export type CardAssignedPayload = {
  eventId: string;
  boardId: string;
  cardId: string;
  boardMemberId: string;
  assignedUserId: string;
  actorUserId: string;
  assignedAt: string;
  invalidate: RealtimeQueryInvalidation[];
};

export type CardMemberAssignedPayload = {
  eventId: string;
  boardId: string;
  cardId: string;
  boardMemberId: string;
  memberUserId: string;
  actorUserId: string;
  createdAt: string;
  invalidate: RealtimeQueryInvalidation[];
};

export type CardMemberUnassignedPayload = {
  eventId: string;
  boardId: string;
  cardId: string;
  boardMemberId: string;
  memberUserId: string;
  actorUserId: string;
  deletedAt: string;
  invalidate: RealtimeQueryInvalidation[];
};

export type CardUpdatedPayload = {
  eventId: string;
  boardId: string;
  cardId: string;
  actorUserId: string;
  changedFields: CardUpdatedField[];
  updatedAt: string;
  invalidate: RealtimeQueryInvalidation[];
};

export type CardReorderedPayload = {
  eventId: string;
  boardId: string;
  actorUserId: string;
  listId?: string;
  updatedAt: string;
};

export type CardMovedPayload = {
  eventId: string;
  boardId: string;
  cardId?: string;
  sourceListId?: string;
  destinationListId?: string;
  actorUserId: string;
  updatedAt: string;
};

export type CardCreatedPayload = {
  eventId: string;
  boardId: string;
  listId: string;
  cardId: string;
  actorUserId: string;
  createdAt: string;
};

export type CardDeletedPayload = {
  eventId: string;
  boardId: string;
  listId: string;
  cardId: string;
  actorUserId: string;
  deletedAt: string;
};

export type MemberUpdatedPayload = {
  boardId: string;
  boardMemberId: string;
  userId: string;
  role: BoardMemberRole;
  action: "added" | "removed" | "role_changed";
  actor: RealtimeActor;
  updatedAt: string;
};

export type BoardUpdatedPayload = {
  eventId: string;
  boardId: string;
  orgId: string;
  actorUserId: string;
  title?: string;
  changedFields: BoardUpdatedField[];
  updatedAt: string;
};

export type BoardDeletedPayload = {
  eventId: string;
  boardId: string;
  orgId: string;
  actorUserId: string;
  deletedAt: string;
};

export type BoardAccessRevokedPayload = {
  eventId: string;
  boardId: string;
  orgId: string;
  targetUserId: string;
  actorUserId: string;
  revokedAt: string;
};

export type BoardMemberAddedPayload = {
  eventId: string;
  boardId: string;
  boardMemberId: string;
  targetUserId: string;
  actorUserId: string;
  createdAt: string;
};

export type BoardMemberRemovedPayload = {
  eventId: string;
  boardId: string;
  orgId: string;
  boardMemberId: string;
  targetUserId: string;
  actorUserId: string;
  removedAt: string;
};

export type BoardMemberRoleUpdatedPayload = {
  eventId: string;
  boardId: string;
  boardMemberId: string;
  targetUserId: string;
  actorUserId: string;
  role: BoardMemberRole;
  updatedAt: string;
};

export type ListCreatedPayload = {
  eventId: string;
  boardId: string;
  listId: string;
  actorUserId: string;
  createdAt: string;
};

export type ListUpdatedPayload = {
  eventId: string;
  boardId: string;
  listId: string;
  actorUserId: string;
  changedFields: Array<"title">;
  updatedAt: string;
};

export type ListDeletedPayload = {
  eventId: string;
  boardId: string;
  listId: string;
  actorUserId: string;
  deletedAt: string;
};

export type ListReorderedPayload = {
  eventId: string;
  boardId: string;
  actorUserId: string;
  updatedAt: string;
};

export type RealtimeEventPayloads = {
  "notification.created": NotificationCreatedPayload;
  "comment.created": CommentCreatedPayload;
  "comment.updated": CommentUpdatedPayload;
  "comment.deleted": CommentDeletedPayload;
  "reaction.created": ReactionCreatedPayload;
  "reaction.updated": ReactionUpdatedPayload;
  "reaction.deleted": ReactionDeletedPayload;
  "card.comment.count.updated": CardCommentCountUpdatedPayload;
  "card.assigned": CardAssignedPayload;
  "card.member.assigned": CardMemberAssignedPayload;
  "card.member.unassigned": CardMemberUnassignedPayload;
  "card.updated": CardUpdatedPayload;
  "card.reordered": CardReorderedPayload;
  "card.moved": CardMovedPayload;
  "card.created": CardCreatedPayload;
  "card.deleted": CardDeletedPayload;
  "member.updated": MemberUpdatedPayload;
  "board.updated": BoardUpdatedPayload;
  "board.deleted": BoardDeletedPayload;
  "board.access.revoked": BoardAccessRevokedPayload;
  "board.member.added": BoardMemberAddedPayload;
  "board.member.removed": BoardMemberRemovedPayload;
  "board.member.role.updated": BoardMemberRoleUpdatedPayload;
  "list.created": ListCreatedPayload;
  "list.updated": ListUpdatedPayload;
  "list.deleted": ListDeletedPayload;
  "list.reordered": ListReorderedPayload;
};
