import "server-only";

import { randomUUID } from "crypto";

import type { CardAssignee } from "@prisma/client";

import type { CardUpdatedField } from "@/lib/realtime/types";
import { realtimeChannels } from "@/lib/realtime/channels";
import { REALTIME_EVENTS } from "@/lib/realtime/events";
import { triggerRealtimeEvent } from "@/lib/realtime/server";
import type { RealtimeQueryInvalidation } from "@/lib/realtime/types";

type CardRealtimeInput = {
  boardId: string;
  cardId: string;
  actorUserId: string;
};

const cardInvalidations = (cardId: string): RealtimeQueryInvalidation[] => [
  {
    queryKey: ["card", cardId],
  },
  {
    queryKey: ["card-logs", cardId],
  },
];

export const triggerCardUpdated = async ({
  boardId,
  cardId,
  actorUserId,
  changedFields,
  updatedAt,
}: CardRealtimeInput & {
  changedFields: CardUpdatedField[];
  updatedAt: Date;
}) => {
  if (changedFields.length === 0) {
    return;
  }

  try {
    const payload = {
      eventId: randomUUID(),
      boardId,
      cardId,
      actorUserId,
      changedFields,
      updatedAt: updatedAt.toISOString(),
      invalidate: cardInvalidations(cardId),
    };

    await triggerRealtimeEvent({
      channel: realtimeChannels.board(boardId),
      event: REALTIME_EVENTS.CARD_UPDATED,
      payload,
    });

    await triggerRealtimeEvent({
      channel: realtimeChannels.card(cardId),
      event: REALTIME_EVENTS.CARD_UPDATED,
      payload,
    });
  } catch (error) {
    console.error("[CARD_REALTIME_ERROR]", error);
  }
};

export const triggerCardMemberAssigned = async ({
  boardId,
  cardId,
  actorUserId,
  assignee,
}: CardRealtimeInput & {
  assignee: CardAssignee & {
    boardMember: {
      userId: string;
    };
  };
}) => {
  try {
    const payload = {
      eventId: randomUUID(),
      boardId,
      cardId,
      boardMemberId: assignee.boardMemberId,
      memberUserId: assignee.boardMember.userId,
      actorUserId,
      createdAt: assignee.createdAt.toISOString(),
      invalidate: cardInvalidations(cardId),
    };

    await triggerRealtimeEvent({
      channel: realtimeChannels.board(boardId),
      event: REALTIME_EVENTS.CARD_MEMBER_ASSIGNED,
      payload,
    });

    await triggerRealtimeEvent({
      channel: realtimeChannels.card(cardId),
      event: REALTIME_EVENTS.CARD_MEMBER_ASSIGNED,
      payload,
    });
  } catch (error) {
    console.error("[CARD_REALTIME_ERROR]", error);
  }
};

export const triggerCardMemberUnassigned = async ({
  boardId,
  cardId,
  actorUserId,
  assignee,
}: CardRealtimeInput & {
  assignee: CardAssignee & {
    boardMember: {
      userId: string;
    };
  };
}) => {
  try {
    const payload = {
      eventId: randomUUID(),
      boardId,
      cardId,
      boardMemberId: assignee.boardMemberId,
      memberUserId: assignee.boardMember.userId,
      actorUserId,
      deletedAt: new Date().toISOString(),
      invalidate: cardInvalidations(cardId),
    };

    await triggerRealtimeEvent({
      channel: realtimeChannels.board(boardId),
      event: REALTIME_EVENTS.CARD_MEMBER_UNASSIGNED,
      payload,
    });

    await triggerRealtimeEvent({
      channel: realtimeChannels.card(cardId),
      event: REALTIME_EVENTS.CARD_MEMBER_UNASSIGNED,
      payload,
    });
  } catch (error) {
    console.error("[CARD_REALTIME_ERROR]", error);
  }
};
