import "server-only";

import { randomUUID } from "crypto";
import type { BoardMemberRole } from "@prisma/client";

import { realtimeChannels } from "@/lib/realtime/channels";
import { REALTIME_EVENTS } from "@/lib/realtime/events";
import { triggerRealtimeEvent } from "@/lib/realtime/server";
import type { BoardUpdatedField, RealtimeQueryInvalidation } from "@/lib/realtime/types";

type BoardRealtimeInput = {
  boardId: string;
  actorUserId: string;
};

const triggerBoardEvent = async <TEvent extends keyof typeof REALTIME_EVENTS>(
  event: (typeof REALTIME_EVENTS)[TEvent],
  boardId: string,
  payload: Parameters<typeof triggerRealtimeEvent>[0]["payload"],
) => {
  await triggerRealtimeEvent({
    channel: realtimeChannels.board(boardId),
    event,
    payload,
  });
};

export const triggerBoardUpdated = async ({
  boardId,
  orgId,
  actorUserId,
  title,
  changedFields,
}: BoardRealtimeInput & {
  orgId: string;
  title?: string;
  changedFields: BoardUpdatedField[];
}) => {
  if (changedFields.length === 0) return;

  try {
    await triggerBoardEvent(REALTIME_EVENTS.BOARD_UPDATED, boardId, {
      eventId: randomUUID(),
      boardId,
      orgId,
      actorUserId,
      title,
      changedFields,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[BOARD_REALTIME_ERROR]", error);
  }
};

export const triggerBoardDeleted = async ({
  boardId,
  orgId,
  actorUserId,
}: BoardRealtimeInput & {
  orgId: string;
}) => {
  try {
    await triggerBoardEvent(REALTIME_EVENTS.BOARD_DELETED, boardId, {
      eventId: randomUUID(),
      boardId,
      orgId,
      actorUserId,
      deletedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[BOARD_REALTIME_ERROR]", error);
  }
};

export const triggerBoardMemberAdded = async ({
  boardId,
  boardMemberId,
  targetUserId,
  actorUserId,
}: BoardRealtimeInput & {
  boardMemberId: string;
  targetUserId: string;
}) => {
  try {
    await triggerBoardEvent(REALTIME_EVENTS.BOARD_MEMBER_ADDED, boardId, {
      eventId: randomUUID(),
      boardId,
      boardMemberId,
      targetUserId,
      actorUserId,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[BOARD_REALTIME_ERROR]", error);
  }
};

export const triggerBoardMemberRemoved = async ({
  boardId,
  orgId,
  boardMemberId,
  targetUserId,
  actorUserId,
}: BoardRealtimeInput & {
  orgId: string;
  boardMemberId: string;
  targetUserId: string;
}) => {
  try {
    const payload = {
      eventId: randomUUID(),
      boardId,
      orgId,
      boardMemberId,
      targetUserId,
      actorUserId,
      removedAt: new Date().toISOString(),
    };

    await triggerBoardEvent(REALTIME_EVENTS.BOARD_MEMBER_REMOVED, boardId, payload);
    await triggerBoardEvent(REALTIME_EVENTS.BOARD_ACCESS_REVOKED, boardId, {
      eventId: randomUUID(),
      boardId,
      orgId,
      targetUserId,
      actorUserId,
      revokedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[BOARD_REALTIME_ERROR]", error);
  }
};

export const triggerBoardMemberRoleUpdated = async ({
  boardId,
  boardMemberId,
  targetUserId,
  actorUserId,
  role,
}: BoardRealtimeInput & {
  boardMemberId: string;
  targetUserId: string;
  role: BoardMemberRole;
}) => {
  try {
    await triggerBoardEvent(REALTIME_EVENTS.BOARD_MEMBER_ROLE_UPDATED, boardId, {
      eventId: randomUUID(),
      boardId,
      boardMemberId,
      targetUserId,
      actorUserId,
      role,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[BOARD_REALTIME_ERROR]", error);
  }
};

export const triggerListCreated = async ({
  boardId,
  listId,
  actorUserId,
}: BoardRealtimeInput & { listId: string }) => {
  try {
    await triggerBoardEvent(REALTIME_EVENTS.LIST_CREATED, boardId, {
      eventId: randomUUID(),
      boardId,
      listId,
      actorUserId,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[BOARD_REALTIME_ERROR]", error);
  }
};

export const triggerListUpdated = async ({
  boardId,
  listId,
  actorUserId,
  title,
}: BoardRealtimeInput & { listId: string; title?: string }) => {
  try {
    await triggerBoardEvent(REALTIME_EVENTS.LIST_UPDATED, boardId, {
      eventId: randomUUID(),
      boardId,
      listId,
      actorUserId,
      changedFields: ["title"],
      ...(title !== undefined ? { title } : {}),
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[BOARD_REALTIME_ERROR]", error);
  }
};

export const triggerListDeleted = async ({
  boardId,
  listId,
  actorUserId,
  archived,
}: BoardRealtimeInput & { listId: string; archived?: boolean }) => {
  try {
    await triggerBoardEvent(REALTIME_EVENTS.LIST_DELETED, boardId, {
      eventId: randomUUID(),
      boardId,
      listId,
      actorUserId,
      deletedAt: new Date().toISOString(),
      ...(archived !== undefined ? { archived } : {}),
    });
  } catch (error) {
    console.error("[BOARD_REALTIME_ERROR]", error);
  }
};

export const triggerListReordered = async ({
  boardId,
  actorUserId,
  orderedListIds,
}: BoardRealtimeInput & {
  orderedListIds?: string[];
}) => {
  try {
    await triggerBoardEvent(REALTIME_EVENTS.LIST_REORDERED, boardId, {
      eventId: randomUUID(),
      boardId,
      actorUserId,
      orderedListIds,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[BOARD_REALTIME_ERROR]", error);
  }
};

export const triggerCardCreated = async ({
  boardId,
  listId,
  cardId,
  actorUserId,
}: BoardRealtimeInput & { listId: string; cardId: string }) => {
  try {
    await triggerBoardEvent(REALTIME_EVENTS.CARD_CREATED, boardId, {
      eventId: randomUUID(),
      boardId,
      listId,
      cardId,
      actorUserId,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[BOARD_REALTIME_ERROR]", error);
  }
};

export const triggerCardDeleted = async ({
  boardId,
  listId,
  cardId,
  actorUserId,
  archived,
}: BoardRealtimeInput & { listId: string; cardId: string; archived?: boolean }) => {
  try {
    const payload = {
      eventId: randomUUID(),
      boardId,
      listId,
      cardId,
      actorUserId,
      deletedAt: new Date().toISOString(),
      ...(archived !== undefined ? { archived } : {}),
    };

    await triggerBoardEvent(REALTIME_EVENTS.CARD_DELETED, boardId, payload);
    await triggerRealtimeEvent({
      channel: realtimeChannels.card(cardId),
      event: REALTIME_EVENTS.CARD_DELETED,
      payload,
    });
  } catch (error) {
    console.error("[BOARD_REALTIME_ERROR]", error);
  }
};

export const triggerCardReordered = async ({
  boardId,
  actorUserId,
  listId,
  orderedCardIds,
}: BoardRealtimeInput & {
  listId?: string;
  orderedCardIds?: string[];
}) => {
  try {
    await triggerBoardEvent(REALTIME_EVENTS.CARD_REORDERED, boardId, {
      eventId: randomUUID(),
      boardId,
      actorUserId,
      listId,
      orderedCardIds,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[BOARD_REALTIME_ERROR]", error);
  }
};

export const triggerCardMoved = async ({
  boardId,
  actorUserId,
  cardId,
  sourceListId,
  destinationListId,
  sourceOrderedCardIds,
  destinationOrderedCardIds,
}: BoardRealtimeInput & {
  cardId?: string;
  sourceListId?: string;
  destinationListId?: string;
  sourceOrderedCardIds?: string[];
  destinationOrderedCardIds?: string[];
}) => {
  try {
    await triggerBoardEvent(REALTIME_EVENTS.CARD_MOVED, boardId, {
      eventId: randomUUID(),
      boardId,
      cardId,
      sourceListId,
      destinationListId,
      sourceOrderedCardIds,
      destinationOrderedCardIds,
      actorUserId,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[BOARD_REALTIME_ERROR]", error);
  }
};

type ChecklistRealtimeInput = BoardRealtimeInput & {
  cardId: string;
  checklistId: string;
  includeLogs?: boolean;
};

type ChecklistItemRealtimeInput = ChecklistRealtimeInput & {
  checklistItemId: string;
  assigneeId?: string | null;
  dueDate?: Date | string | null;
};

const checklistInvalidations = (
  cardId: string,
  includeLogs = false,
): RealtimeQueryInvalidation[] => [
  {
    queryKey: ["card", cardId],
  },
  ...(includeLogs
    ? [{
        queryKey: ["card-logs", cardId],
      } as RealtimeQueryInvalidation]
    : []),
];

const triggerChecklistEvent = async ({
  event,
  action,
  timestampField,
  boardId,
  cardId,
  checklistId,
  actorUserId,
  includeLogs,
}: ChecklistRealtimeInput & {
  event:
    | typeof REALTIME_EVENTS.CHECKLIST_CREATED
    | typeof REALTIME_EVENTS.CHECKLIST_UPDATED
    | typeof REALTIME_EVENTS.CHECKLIST_DELETED;
  action: "created" | "updated" | "deleted";
  timestampField: "createdAt" | "updatedAt" | "deletedAt";
}) => {
  try {
    await triggerBoardEvent(event, boardId, {
      eventId: randomUUID(),
      boardId,
      cardId,
      checklistId,
      actorUserId,
      action,
      [timestampField]: new Date().toISOString(),
      invalidate: checklistInvalidations(cardId, includeLogs),
    });
  } catch (error) {
    console.error("[BOARD_REALTIME_ERROR]", error);
  }
};

const triggerChecklistItemEvent = async ({
  event,
  action,
  timestampField,
  boardId,
  cardId,
  checklistId,
  checklistItemId,
  actorUserId,
  includeLogs,
  assigneeId,
  dueDate,
}: ChecklistItemRealtimeInput & {
  event:
    | typeof REALTIME_EVENTS.CHECKLIST_ITEM_CREATED
    | typeof REALTIME_EVENTS.CHECKLIST_ITEM_UPDATED
    | typeof REALTIME_EVENTS.CHECKLIST_ITEM_DELETED
    | typeof REALTIME_EVENTS.CHECKLIST_ITEM_TOGGLED
    | typeof REALTIME_EVENTS.CHECKLIST_ITEM_ASSIGNEE_UPDATED
    | typeof REALTIME_EVENTS.CHECKLIST_ITEM_DUE_DATE_UPDATED;
  action:
    | "created"
    | "updated"
    | "deleted"
    | "toggled"
    | "assignee-updated"
    | "due-date-updated";
  timestampField: "createdAt" | "updatedAt" | "deletedAt" | "toggledAt";
}) => {
  try {
    const dueDateValue = dueDate instanceof Date
      ? dueDate.toISOString()
      : dueDate;

    await triggerBoardEvent(event, boardId, {
      eventId: randomUUID(),
      boardId,
      cardId,
      checklistId,
      checklistItemId,
      actorUserId,
      action,
      ...(assigneeId !== undefined ? { assigneeId } : {}),
      ...(dueDate !== undefined ? { dueDate: dueDateValue } : {}),
      [timestampField]: new Date().toISOString(),
      invalidate: checklistInvalidations(cardId, includeLogs),
    });
  } catch (error) {
    console.error("[BOARD_REALTIME_ERROR]", error);
  }
};

export const triggerChecklistCreated = (input: ChecklistRealtimeInput) =>
  triggerChecklistEvent({
    ...input,
    event: REALTIME_EVENTS.CHECKLIST_CREATED,
    action: "created",
    timestampField: "createdAt",
  });

export const triggerChecklistUpdated = (input: ChecklistRealtimeInput) =>
  triggerChecklistEvent({
    ...input,
    event: REALTIME_EVENTS.CHECKLIST_UPDATED,
    action: "updated",
    timestampField: "updatedAt",
  });

export const triggerChecklistDeleted = (input: ChecklistRealtimeInput) =>
  triggerChecklistEvent({
    ...input,
    event: REALTIME_EVENTS.CHECKLIST_DELETED,
    action: "deleted",
    timestampField: "deletedAt",
  });

export const triggerChecklistItemCreated = (input: ChecklistItemRealtimeInput) =>
  triggerChecklistItemEvent({
    ...input,
    event: REALTIME_EVENTS.CHECKLIST_ITEM_CREATED,
    action: "created",
    timestampField: "createdAt",
  });

export const triggerChecklistItemUpdated = (input: ChecklistItemRealtimeInput) =>
  triggerChecklistItemEvent({
    ...input,
    event: REALTIME_EVENTS.CHECKLIST_ITEM_UPDATED,
    action: "updated",
    timestampField: "updatedAt",
  });

export const triggerChecklistItemDeleted = (input: ChecklistItemRealtimeInput) =>
  triggerChecklistItemEvent({
    ...input,
    event: REALTIME_EVENTS.CHECKLIST_ITEM_DELETED,
    action: "deleted",
    timestampField: "deletedAt",
  });

export const triggerChecklistItemToggled = (input: ChecklistItemRealtimeInput) =>
  triggerChecklistItemEvent({
    ...input,
    event: REALTIME_EVENTS.CHECKLIST_ITEM_TOGGLED,
    action: "toggled",
    timestampField: "toggledAt",
  });

export const triggerChecklistItemAssigneeUpdated = (
  input: ChecklistItemRealtimeInput & { assigneeId: string | null },
) =>
  triggerChecklistItemEvent({
    ...input,
    event: REALTIME_EVENTS.CHECKLIST_ITEM_ASSIGNEE_UPDATED,
    action: "assignee-updated",
    timestampField: "updatedAt",
  });

export const triggerChecklistItemDueDateUpdated = (
  input: ChecklistItemRealtimeInput & { dueDate: Date | null },
) =>
  triggerChecklistItemEvent({
    ...input,
    event: REALTIME_EVENTS.CHECKLIST_ITEM_DUE_DATE_UPDATED,
    action: "due-date-updated",
    timestampField: "updatedAt",
  });

export const triggerChecklistItemReordered = async ({
  boardId,
  cardId,
  checklistId,
  actorUserId,
  orderedItemIds,
}: ChecklistRealtimeInput & {
  orderedItemIds: string[];
}) => {
  try {
    await triggerBoardEvent(REALTIME_EVENTS.CHECKLIST_ITEM_REORDERED, boardId, {
      eventId: randomUUID(),
      boardId,
      cardId,
      checklistId,
      actorUserId,
      orderedItemIds,
      reorderedAt: new Date().toISOString(),
      invalidate: checklistInvalidations(cardId, false),
    });
  } catch (error) {
    console.error("[BOARD_REALTIME_ERROR]", error);
  }
};

export const triggerChecklistItemMoved = async ({
  boardId,
  cardId,
  checklistItemId,
  sourceChecklistId,
  destinationChecklistId,
  actorUserId,
  sourceOrderedItemIds,
  destinationOrderedItemIds,
}: BoardRealtimeInput & {
  cardId: string;
  checklistItemId: string;
  sourceChecklistId: string;
  destinationChecklistId: string;
  sourceOrderedItemIds: string[];
  destinationOrderedItemIds: string[];
}) => {
  try {
    await triggerBoardEvent(REALTIME_EVENTS.CHECKLIST_ITEM_MOVED, boardId, {
      eventId: randomUUID(),
      boardId,
      cardId,
      checklistItemId,
      sourceChecklistId,
      destinationChecklistId,
      actorUserId,
      sourceOrderedItemIds,
      destinationOrderedItemIds,
      movedAt: new Date().toISOString(),
      invalidate: checklistInvalidations(cardId, false),
    });
  } catch (error) {
    console.error("[BOARD_REALTIME_ERROR]", error);
  }
};

const labelInvalidations = (cardId?: string): RealtimeQueryInvalidation[] =>
  cardId
    ? [{
        queryKey: ["card", cardId],
      }]
    : [];

type LabelRealtimeInput = BoardRealtimeInput & {
  labelId: string;
  cardId?: string;
  labelName?: string;
  labelColor?: string;
};

const triggerLabelEvent = async ({
  event,
  timestampField,
  boardId,
  cardId,
  labelId,
  actorUserId,
  labelName,
  labelColor,
}: LabelRealtimeInput & {
  event:
    | typeof REALTIME_EVENTS.LABEL_CREATED
    | typeof REALTIME_EVENTS.LABEL_UPDATED
    | typeof REALTIME_EVENTS.LABEL_DELETED;
  timestampField: "createdAt" | "updatedAt" | "deletedAt";
}) => {
  try {
    await triggerBoardEvent(event, boardId, {
      eventId: randomUUID(),
      boardId,
      ...(cardId ? { cardId } : {}),
      labelId,
      actorUserId,
      ...(labelName !== undefined ? { labelName } : {}),
      ...(labelColor !== undefined ? { labelColor } : {}),
      [timestampField]: new Date().toISOString(),
      invalidate: labelInvalidations(cardId),
    });
  } catch (error) {
    console.error("[BOARD_REALTIME_ERROR]", error);
  }
};

const triggerCardLabelEvent = async ({
  event,
  timestampField,
  boardId,
  cardId,
  labelId,
  actorUserId,
  labelName,
  labelColor,
}: LabelRealtimeInput & {
  cardId: string;
  event:
    | typeof REALTIME_EVENTS.CARD_LABEL_ATTACHED
    | typeof REALTIME_EVENTS.CARD_LABEL_DETACHED;
  timestampField: "attachedAt" | "detachedAt";
}) => {
  try {
    await triggerBoardEvent(event, boardId, {
      eventId: randomUUID(),
      boardId,
      cardId,
      labelId,
      actorUserId,
      ...(labelName !== undefined ? { labelName } : {}),
      ...(labelColor !== undefined ? { labelColor } : {}),
      [timestampField]: new Date().toISOString(),
      invalidate: labelInvalidations(cardId),
    });
  } catch (error) {
    console.error("[BOARD_REALTIME_ERROR]", error);
  }
};

export const triggerLabelCreated = (input: LabelRealtimeInput) =>
  triggerLabelEvent({
    ...input,
    event: REALTIME_EVENTS.LABEL_CREATED,
    timestampField: "createdAt",
  });

export const triggerLabelUpdated = (input: LabelRealtimeInput) =>
  triggerLabelEvent({
    ...input,
    event: REALTIME_EVENTS.LABEL_UPDATED,
    timestampField: "updatedAt",
  });

export const triggerLabelDeleted = (input: LabelRealtimeInput) =>
  triggerLabelEvent({
    ...input,
    event: REALTIME_EVENTS.LABEL_DELETED,
    timestampField: "deletedAt",
  });

export const triggerCardLabelAttached = (input: LabelRealtimeInput & { cardId: string }) =>
  triggerCardLabelEvent({
    ...input,
    event: REALTIME_EVENTS.CARD_LABEL_ATTACHED,
    timestampField: "attachedAt",
  });

export const triggerCardLabelDetached = (input: LabelRealtimeInput & { cardId: string }) =>
  triggerCardLabelEvent({
    ...input,
    event: REALTIME_EVENTS.CARD_LABEL_DETACHED,
    timestampField: "detachedAt",
  });
