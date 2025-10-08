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
  boardId: string;
  cardId: string;
  boardMemberId: string;
  assignedUserId: string;
  actor: RealtimeActor;
  assignedAt: string;
  invalidate: RealtimeQueryInvalidation[];
};

export type CardUpdatedPayload = {
  boardId: string;
  cardId: string;
  actor: RealtimeActor;
  changedFields: Array<
    "title" | "description" | "dueDate" | "isCompleted" | "reminder"
  >;
  updatedAt: string;
  invalidate: RealtimeQueryInvalidation[];
};

export type CardMovedPayload = {
  boardId: string;
  cardId: string;
  fromListId: string;
  toListId: string;
  actor: RealtimeActor;
  movedAt: string;
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
  boardId: string;
  orgId: string;
  actor: RealtimeActor;
  changedFields: Array<"title" | "members" | "settings">;
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
  "card.assigned": CardAssignedPayload;
  "card.updated": CardUpdatedPayload;
  "card.moved": CardMovedPayload;
  "member.updated": MemberUpdatedPayload;
  "board.updated": BoardUpdatedPayload;
};
