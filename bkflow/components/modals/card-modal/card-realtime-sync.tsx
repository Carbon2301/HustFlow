"use client";

import { useCallback, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { toast } from "sonner";

import {
  useRealtimeChannel,
  useRealtimeInvalidation,
} from "@/hooks/use-realtime-channel";
import { useCardModal } from "@/hooks/use-card-modal";
import { realtimeChannels } from "@/lib/realtime/channels";
import { isRealtimeClientConfigured } from "@/lib/realtime/client";
import { REALTIME_EVENTS } from "@/lib/realtime/events";
import type {
  CommentCreatedPayload,
  CommentDeletedPayload,
  CommentUpdatedPayload,
  CardMemberAssignedPayload,
  CardMemberUnassignedPayload,
  CardDeletedPayload,
  CardUpdatedPayload,
  AttachmentCreatedPayload,
  AttachmentDeletedPayload,
  AttachmentUpdatedPayload,
  ReactionCreatedPayload,
  ReactionDeletedPayload,
  ReactionUpdatedPayload,
  RealtimeQueryInvalidation,
} from "@/lib/realtime/types";

type CardCommentRealtimePayload =
  | CommentCreatedPayload
  | CommentUpdatedPayload
  | CommentDeletedPayload
  | ReactionCreatedPayload
  | ReactionUpdatedPayload
  | ReactionDeletedPayload
  | CardUpdatedPayload
  | CardMemberAssignedPayload
  | CardMemberUnassignedPayload
  | AttachmentCreatedPayload
  | AttachmentUpdatedPayload
  | AttachmentDeletedPayload;

export const CardRealtimeSync = ({
  cardId,
  isOpen,
}: {
  cardId: string | null | undefined;
  isOpen: boolean;
}) => {
  const { user, isLoaded } = useUser();
  const cardModal = useCardModal();
  const invalidateRealtimeQueries = useRealtimeInvalidation();
  const processedEventIdsRef = useRef<Set<string>>(new Set());

  const handleRealtimeEvent = useCallback(
    (payload: CardCommentRealtimePayload) => {
      if (!cardId || payload.cardId !== cardId) {
        return;
      }

      if (processedEventIdsRef.current.has(payload.eventId)) {
        return;
      }

      processedEventIdsRef.current.add(payload.eventId);

      if (user && payload.actorUserId === user.id) {
        return;
      }

      invalidateRealtimeQueries(
        payload.invalidate as RealtimeQueryInvalidation[],
      );
    },
    [cardId, invalidateRealtimeQueries, user],
  );

  const handleCardDeleted = useCallback((payload: CardDeletedPayload) => {
    if (!cardId || payload.cardId !== cardId) {
      return;
    }

    if (processedEventIdsRef.current.has(payload.eventId)) {
      return;
    }

    processedEventIdsRef.current.add(payload.eventId);

    if (user && payload.actorUserId === user.id) {
      return;
    }

    toast.error("Thẻ này đã bị xóa.");
    cardModal.onClose();
  }, [cardId, cardModal, user]);

  const channelName = cardId ? realtimeChannels.card(cardId) : null;
  const enabled =
    isOpen &&
    isLoaded &&
    Boolean(user) &&
    Boolean(cardId) &&
    isRealtimeClientConfigured();

  useRealtimeChannel({
    channelName,
    event: REALTIME_EVENTS.COMMENT_CREATED,
    onEvent: handleRealtimeEvent,
    enabled,
  });

  useRealtimeChannel({
    channelName,
    event: REALTIME_EVENTS.COMMENT_UPDATED,
    onEvent: handleRealtimeEvent,
    enabled,
  });

  useRealtimeChannel({
    channelName,
    event: REALTIME_EVENTS.COMMENT_DELETED,
    onEvent: handleRealtimeEvent,
    enabled,
  });

  useRealtimeChannel({
    channelName,
    event: REALTIME_EVENTS.REACTION_CREATED,
    onEvent: handleRealtimeEvent,
    enabled,
  });

  useRealtimeChannel({
    channelName,
    event: REALTIME_EVENTS.REACTION_UPDATED,
    onEvent: handleRealtimeEvent,
    enabled,
  });

  useRealtimeChannel({
    channelName,
    event: REALTIME_EVENTS.REACTION_DELETED,
    onEvent: handleRealtimeEvent,
    enabled,
  });

  useRealtimeChannel({
    channelName,
    event: REALTIME_EVENTS.CARD_UPDATED,
    onEvent: handleRealtimeEvent,
    enabled,
  });

  useRealtimeChannel({
    channelName,
    event: REALTIME_EVENTS.CARD_MEMBER_ASSIGNED,
    onEvent: handleRealtimeEvent,
    enabled,
  });

  useRealtimeChannel({
    channelName,
    event: REALTIME_EVENTS.CARD_MEMBER_UNASSIGNED,
    onEvent: handleRealtimeEvent,
    enabled,
  });

  useRealtimeChannel({
    channelName,
    event: REALTIME_EVENTS.ATTACHMENT_CREATED,
    onEvent: handleRealtimeEvent,
    enabled,
  });

  useRealtimeChannel({
    channelName,
    event: REALTIME_EVENTS.ATTACHMENT_UPDATED,
    onEvent: handleRealtimeEvent,
    enabled,
  });

  useRealtimeChannel({
    channelName,
    event: REALTIME_EVENTS.ATTACHMENT_DELETED,
    onEvent: handleRealtimeEvent,
    enabled,
  });

  useRealtimeChannel({
    channelName,
    event: REALTIME_EVENTS.CARD_DELETED,
    onEvent: handleCardDeleted,
    enabled,
  });

  return null;
};
