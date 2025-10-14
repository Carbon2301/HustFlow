import "server-only";

import { randomUUID } from "crypto";
import type { BoardMemberRole } from "@prisma/client";

import { realtimeChannels } from "@/lib/realtime/channels";
import { REALTIME_EVENTS } from "@/lib/realtime/events";
import { triggerRealtimeEvent } from "@/lib/realtime/server";
import type { BoardUpdatedField } from "@/lib/realtime/types";

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
}: BoardRealtimeInput & { listId: string }) => {
  try {
    await triggerBoardEvent(REALTIME_EVENTS.LIST_UPDATED, boardId, {
      eventId: randomUUID(),
      boardId,
      listId,
      actorUserId,
      changedFields: ["title"],
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
}: BoardRealtimeInput & { listId: string }) => {
  try {
    await triggerBoardEvent(REALTIME_EVENTS.LIST_DELETED, boardId, {
      eventId: randomUUID(),
      boardId,
      listId,
      actorUserId,
      deletedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[BOARD_REALTIME_ERROR]", error);
  }
};

export const triggerListReordered = async ({
  boardId,
  actorUserId,
}: BoardRealtimeInput) => {
  try {
    await triggerBoardEvent(REALTIME_EVENTS.LIST_REORDERED, boardId, {
      eventId: randomUUID(),
      boardId,
      actorUserId,
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
}: BoardRealtimeInput & { listId: string; cardId: string }) => {
  try {
    const payload = {
      eventId: randomUUID(),
      boardId,
      listId,
      cardId,
      actorUserId,
      deletedAt: new Date().toISOString(),
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
}: BoardRealtimeInput & {
  listId?: string;
}) => {
  try {
    await triggerBoardEvent(REALTIME_EVENTS.CARD_REORDERED, boardId, {
      eventId: randomUUID(),
      boardId,
      actorUserId,
      listId,
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
}: BoardRealtimeInput & {
  cardId?: string;
  sourceListId?: string;
  destinationListId?: string;
}) => {
  try {
    await triggerBoardEvent(REALTIME_EVENTS.CARD_MOVED, boardId, {
      eventId: randomUUID(),
      boardId,
      cardId,
      sourceListId,
      destinationListId,
      actorUserId,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[BOARD_REALTIME_ERROR]", error);
  }
};
