import type { AttachmentType, BoardMemberRole, NOTIFICATION_TYPE } from "@prisma/client";

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
  | "startDate"
  | "dueDate"
  | "isCompleted"
  | "reminder"
  | "reminderSetAt"
  | "assignees"
  | "dependencies";

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
  boardTitle?: string | null;
  cardId?: string | null;
  cardTitle?: string | null;
  listTitle?: string | null;
  commentId?: string | null;
  dueDate?: string | null;
  triggerTime?: string | null;
  reminderLabel?: string | null;
  dedupeKey?: string | null;
  createdAt: string;
  updatedAt: string;
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
  card?: {
    id: string;
    title: string;
    description: string | null;
    descriptionUpdatedAt: string;
    startDate: string | null;
    dueDate: string | null;
    isCompleted: boolean;
    reminder: string | null;
    reminderSetAt: string | null;
  };
  updatedAt: string;
  invalidate: RealtimeQueryInvalidation[];
};

export type CardReorderedPayload = {
  eventId: string;
  boardId: string;
  actorUserId: string;
  listId?: string;
  orderedCardIds?: string[];
  updatedAt: string;
};

export type CardMovedPayload = {
  eventId: string;
  boardId: string;
  cardId?: string;
  sourceListId?: string;
  destinationListId?: string;
  sourceOrderedCardIds?: string[];
  destinationOrderedCardIds?: string[];
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
  archived?: boolean;
};

export type AttachmentPayload = {
  eventId: string;
  boardId: string;
  cardId: string;
  attachmentId: string;
  attachmentType: AttachmentType;
  actorUserId: string;
  timestamp: string;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string;
  invalidate: RealtimeQueryInvalidation[];
};

export type AttachmentCreatedPayload = AttachmentPayload;
export type AttachmentUpdatedPayload = AttachmentPayload;
export type AttachmentDeletedPayload = AttachmentPayload;

export type AttachmentReorderedPayload = {
  eventId: string;
  boardId: string;
  cardId: string;
  attachmentType: AttachmentType;
  actorUserId: string;
  timestamp: string;
  invalidate: RealtimeQueryInvalidation[];
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
  title?: string;
  updatedAt: string;
};

export type ListDeletedPayload = {
  eventId: string;
  boardId: string;
  listId: string;
  actorUserId: string;
  deletedAt: string;
  archived?: boolean;
};

export type ListReorderedPayload = {
  eventId: string;
  boardId: string;
  actorUserId: string;
  orderedListIds?: string[];
  updatedAt: string;
};

export type ChecklistPayload = {
  eventId: string;
  boardId: string;
  cardId: string;
  checklistId: string;
  actorUserId: string;
  action: "created" | "updated" | "deleted";
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string;
  invalidate: RealtimeQueryInvalidation[];
};

export type ChecklistItemPayload = {
  eventId: string;
  boardId: string;
  cardId: string;
  checklistId: string;
  checklistItemId: string;
  actorUserId: string;
  action:
    | "created"
    | "updated"
    | "deleted"
    | "toggled"
    | "assignee-updated"
    | "due-date-updated";
  assigneeId?: string | null;
  dueDate?: string | null;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string;
  toggledAt?: string;
  invalidate: RealtimeQueryInvalidation[];
};

export type ChecklistItemReorderedPayload = {
  eventId: string;
  boardId: string;
  cardId: string;
  checklistId: string;
  actorUserId: string;
  orderedItemIds: string[];
  reorderedAt: string;
  invalidate: RealtimeQueryInvalidation[];
};

export type ChecklistItemMovedPayload = {
  eventId: string;
  boardId: string;
  cardId: string;
  checklistItemId: string;
  sourceChecklistId: string;
  destinationChecklistId: string;
  actorUserId: string;
  sourceOrderedItemIds: string[];
  destinationOrderedItemIds: string[];
  movedAt: string;
  invalidate: RealtimeQueryInvalidation[];
};

export type LabelPayload = {
  eventId: string;
  boardId: string;
  cardId?: string;
  labelId: string;
  actorUserId: string;
  labelName?: string;
  labelColor?: string;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string;
  invalidate: RealtimeQueryInvalidation[];
};

export type CardLabelPayload = {
  eventId: string;
  boardId: string;
  cardId: string;
  labelId: string;
  actorUserId: string;
  labelName?: string;
  labelColor?: string;
  attachedAt?: string;
  detachedAt?: string;
  invalidate: RealtimeQueryInvalidation[];
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
  "attachment.created": AttachmentCreatedPayload;
  "attachment.updated": AttachmentUpdatedPayload;
  "attachment.deleted": AttachmentDeletedPayload;
  "attachment.reordered": AttachmentReorderedPayload;
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
  "checklist.created": ChecklistPayload;
  "checklist.updated": ChecklistPayload;
  "checklist.deleted": ChecklistPayload;
  "checklist-item.created": ChecklistItemPayload;
  "checklist-item.updated": ChecklistItemPayload;
  "checklist-item.deleted": ChecklistItemPayload;
  "checklist-item.toggled": ChecklistItemPayload;
  "checklist-item.assignee-updated": ChecklistItemPayload;
  "checklist-item.due-date-updated": ChecklistItemPayload;
  "checklist-item.reordered": ChecklistItemReorderedPayload;
  "checklist-item.moved": ChecklistItemMovedPayload;
  "label.created": LabelPayload;
  "label.updated": LabelPayload;
  "label.deleted": LabelPayload;
  "card-label.attached": CardLabelPayload;
  "card-label.detached": CardLabelPayload;
};
