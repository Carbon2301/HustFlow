import "server-only";

import { randomUUID } from "crypto";

import type { AttachmentType, CardAssignee, CardAttachment } from "@prisma/client";

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

type AttachmentRealtimeInput = CardRealtimeInput & {
  attachment: CardAttachment;
};

const triggerAttachmentEvent = async ({
  event,
  timestampField,
  boardId,
  cardId,
  actorUserId,
  attachment,
}: AttachmentRealtimeInput & {
  event:
    | typeof REALTIME_EVENTS.ATTACHMENT_CREATED
    | typeof REALTIME_EVENTS.ATTACHMENT_UPDATED
    | typeof REALTIME_EVENTS.ATTACHMENT_DELETED;
  timestampField: "createdAt" | "updatedAt" | "deletedAt";
}) => {
  try {
    const timestamp = new Date().toISOString();
    const payload = {
      eventId: randomUUID(),
      boardId,
      cardId,
      attachmentId: attachment.id,
      attachmentType: attachment.type,
      actorUserId,
      timestamp,
      [timestampField]: timestamp,
      invalidate: cardInvalidations(cardId),
    };

    await triggerRealtimeEvent({
      channel: realtimeChannels.board(boardId),
      event,
      payload,
    });

    await triggerRealtimeEvent({
      channel: realtimeChannels.card(cardId),
      event,
      payload,
    });
  } catch (error) {
    console.error("[ATTACHMENT_REALTIME_ERROR]", error);
  }
};

export const triggerAttachmentCreated = (input: AttachmentRealtimeInput) =>
  triggerAttachmentEvent({
    ...input,
    event: REALTIME_EVENTS.ATTACHMENT_CREATED,
    timestampField: "createdAt",
  });

export const triggerAttachmentUpdated = (input: AttachmentRealtimeInput) =>
  triggerAttachmentEvent({
    ...input,
    event: REALTIME_EVENTS.ATTACHMENT_UPDATED,
    timestampField: "updatedAt",
  });

export const triggerAttachmentDeleted = (input: AttachmentRealtimeInput) =>
  triggerAttachmentEvent({
    ...input,
    event: REALTIME_EVENTS.ATTACHMENT_DELETED,
    timestampField: "deletedAt",
  });

export const triggerAttachmentReordered = async ({
  boardId,
  cardId,
  actorUserId,
  attachmentType,
}: CardRealtimeInput & {
  attachmentType: AttachmentType;
}) => {
  try {
    await triggerRealtimeEvent({
      channel: realtimeChannels.board(boardId),
      event: REALTIME_EVENTS.ATTACHMENT_REORDERED,
      payload: {
        eventId: randomUUID(),
        boardId,
        cardId,
        attachmentType,
        actorUserId,
        timestamp: new Date().toISOString(),
        invalidate: [
          {
            queryKey: ["card", cardId],
          },
        ],
      },
    });
  } catch (error) {
    console.error("[ATTACHMENT_REALTIME_ERROR]", error);
  }
};
