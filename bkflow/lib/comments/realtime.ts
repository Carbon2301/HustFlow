import "server-only";

import { randomUUID } from "crypto";

import type { CardComment, CardCommentReaction } from "@prisma/client";

import { realtimeChannels } from "@/lib/realtime/channels";
import { REALTIME_EVENTS } from "@/lib/realtime/events";
import { triggerRealtimeEvent } from "@/lib/realtime/server";
import type { RealtimeQueryInvalidation } from "@/lib/realtime/types";

type CardCommentRealtimeInput = {
  boardId: string;
  cardId: string;
  actorUserId: string;
};

type CardCommentReactionRealtimeInput = CardCommentRealtimeInput & {
  commentId: string;
};

const cardCommentInvalidations = (
  cardId: string,
): RealtimeQueryInvalidation[] => [
    {
      queryKey: ["card-comments", cardId],
    },
  ];

export const triggerCommentCreated = async ({
  boardId,
  cardId,
  actorUserId,
  comment,
}: CardCommentRealtimeInput & {
  comment: CardComment;
}) => {
  try {
    const payload = {
      eventId: randomUUID(),
      boardId,
      cardId,
      commentId: comment.id,
      parentId: comment.parentId,
      actorUserId,
      createdAt: comment.createdAt.toISOString(),
      invalidate: cardCommentInvalidations(cardId),
    };

    await triggerRealtimeEvent({
      channel: realtimeChannels.card(cardId),
      event: REALTIME_EVENTS.COMMENT_CREATED,
      payload,
    });

    await triggerRealtimeEvent({
      channel: realtimeChannels.board(boardId),
      event: REALTIME_EVENTS.COMMENT_CREATED,
      payload,
    });
  } catch (error) {
    console.error("[COMMENT_REALTIME_ERROR]", error);
  }
};

export const triggerCommentUpdated = async ({
  boardId,
  cardId,
  actorUserId,
  comment,
}: CardCommentRealtimeInput & {
  comment: CardComment;
}) => {
  try {
    await triggerRealtimeEvent({
      channel: realtimeChannels.card(cardId),
      event: REALTIME_EVENTS.COMMENT_UPDATED,
      payload: {
        eventId: randomUUID(),
        boardId,
        cardId,
        commentId: comment.id,
        actorUserId,
        updatedAt: comment.updatedAt.toISOString(),
        invalidate: cardCommentInvalidations(cardId),
      },
    });
  } catch (error) {
    console.error("[COMMENT_REALTIME_ERROR]", error);
  }
};

export const triggerCommentDeleted = async ({
  boardId,
  cardId,
  actorUserId,
  comment,
  deletedCount,
}: CardCommentRealtimeInput & {
  comment: CardComment;
  deletedCount?: number;
}) => {
  try {
    const payload = {
      eventId: randomUUID(),
      boardId,
      cardId,
      commentId: comment.id,
      actorUserId,
      deletedAt: new Date().toISOString(),
      invalidate: cardCommentInvalidations(cardId),
      deletedCount,
    };

    await triggerRealtimeEvent({
      channel: realtimeChannels.card(cardId),
      event: REALTIME_EVENTS.COMMENT_DELETED,
      payload,
    });

    await triggerRealtimeEvent({
      channel: realtimeChannels.board(boardId),
      event: REALTIME_EVENTS.COMMENT_DELETED,
      payload,
    });
  } catch (error) {
    console.error("[COMMENT_REALTIME_ERROR]", error);
  }
};

export const triggerReactionCreated = async ({
  boardId,
  cardId,
  commentId,
  actorUserId,
  reaction,
}: CardCommentReactionRealtimeInput & {
  reaction: CardCommentReaction;
}) => {
  try {
    await triggerRealtimeEvent({
      channel: realtimeChannels.card(cardId),
      event: REALTIME_EVENTS.REACTION_CREATED,
      payload: {
        eventId: randomUUID(),
        boardId,
        cardId,
        commentId,
        reactionId: reaction.id,
        actorUserId,
        createdAt: reaction.createdAt.toISOString(),
        invalidate: cardCommentInvalidations(cardId),
      },
    });
  } catch (error) {
    console.error("[REACTION_REALTIME_ERROR]", error);
  }
};

export const triggerReactionUpdated = async ({
  boardId,
  cardId,
  commentId,
  actorUserId,
  reaction,
}: CardCommentReactionRealtimeInput & {
  reaction: CardCommentReaction;
}) => {
  try {
    await triggerRealtimeEvent({
      channel: realtimeChannels.card(cardId),
      event: REALTIME_EVENTS.REACTION_UPDATED,
      payload: {
        eventId: randomUUID(),
        boardId,
        cardId,
        commentId,
        reactionId: reaction.id,
        actorUserId,
        emoji: reaction.emoji,
        updatedAt: new Date().toISOString(),
        invalidate: cardCommentInvalidations(cardId),
      },
    });
  } catch (error) {
    console.error("[REACTION_REALTIME_ERROR]", error);
  }
};

export const triggerReactionDeleted = async ({
  boardId,
  cardId,
  commentId,
  actorUserId,
  reaction,
}: CardCommentReactionRealtimeInput & {
  reaction: CardCommentReaction;
}) => {
  try {
    await triggerRealtimeEvent({
      channel: realtimeChannels.card(cardId),
      event: REALTIME_EVENTS.REACTION_DELETED,
      payload: {
        eventId: randomUUID(),
        boardId,
        cardId,
        commentId,
        reactionId: reaction.id,
        actorUserId,
        deletedAt: new Date().toISOString(),
        invalidate: cardCommentInvalidations(cardId),
      },
    });
  } catch (error) {
    console.error("[REACTION_REALTIME_ERROR]", error);
  }
};
