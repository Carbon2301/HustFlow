"use client";

import { Dispatch, SetStateAction, useCallback, useRef } from "react";
import { toast } from "sonner";
import { QueryClient } from "@tanstack/react-query";

import { ListWithCards } from "@/types";
import type {
  AttachmentReorderedPayload,
  BoardAccessRevokedPayload,
  BoardDeletedPayload,
  BoardMemberAddedPayload,
  BoardMemberRemovedPayload,
  BoardMemberRoleUpdatedPayload,
  BoardUpdatedPayload,
  CardCommentCountUpdatedPayload,
  CardCreatedPayload,
  CardDeletedPayload,
  CardLabelPayload,
  CardMemberAssignedPayload,
  CardMemberUnassignedPayload,
  CardMovedPayload,
  CardReorderedPayload,
  CardUpdatedPayload,
  ChecklistItemMovedPayload,
  ChecklistItemPayload,
  ChecklistItemReorderedPayload,
  ChecklistPayload,
  LabelPayload,
  ListCreatedPayload,
  ListDeletedPayload,
  ListReorderedPayload,
  ListUpdatedPayload,
} from "@/lib/realtime/types";

type CardModalApi = {
  id?: string | null;
  isOpen: boolean;
  onClose: () => void;
};

type RouterApi = {
  refresh: () => void;
  push: (href: string) => void;
};

type UseBoardRealtimeSyncOptions = {
  boardId: string;
  currentUserId: string;
  cardModal: CardModalApi;
  router: RouterApi;
  queryClient: QueryClient;
  setOrderedData: Dispatch<SetStateAction<ListWithCards[]>>;
};

export const useBoardRealtimeSync = ({
  boardId,
  currentUserId,
  cardModal,
  router,
  queryClient,
  setOrderedData,
}: UseBoardRealtimeSyncOptions) => {
  const processedCardEventIdsRef = useRef<Set<string>>(new Set());

  const processBoardEvent = useCallback((eventId: string) => {
    if (processedCardEventIdsRef.current.has(eventId)) {
      return false;
    }

    processedCardEventIdsRef.current.add(eventId);
    return true;
  }, []);

  const handleBoardCardSync = useCallback((
    payload:
      | CardUpdatedPayload
      | CardMemberAssignedPayload
      | CardMemberUnassignedPayload
      | CardCreatedPayload
      | CardDeletedPayload
      | ListCreatedPayload
      | ListUpdatedPayload
      | ListDeletedPayload
      | ListReorderedPayload
      | BoardUpdatedPayload
      | BoardMemberAddedPayload
      | BoardMemberRoleUpdatedPayload
      | CardReorderedPayload
      | CardMovedPayload,
  ) => {
    if (payload.boardId !== boardId) {
      return;
    }

    if (!processBoardEvent(payload.eventId)) {
      return;
    }

    if (payload.actorUserId === currentUserId) {
      return;
    }

    router.refresh();
  }, [boardId, currentUserId, processBoardEvent, router]);

  const handleBoardDeleted = useCallback((payload: BoardDeletedPayload) => {
    if (payload.boardId !== boardId || !processBoardEvent(payload.eventId)) {
      return;
    }

    if (payload.actorUserId === currentUserId) {
      return;
    }

    toast.error("Bảng này đã bị xóa.");
    cardModal.onClose();
    router.push(`/organization/${payload.orgId}`);
  }, [boardId, cardModal, currentUserId, processBoardEvent, router]);

  const handleAccessRevoked = useCallback((payload: BoardAccessRevokedPayload) => {
    if (payload.boardId !== boardId || !processBoardEvent(payload.eventId)) {
      return;
    }

    if (payload.targetUserId !== currentUserId) {
      router.refresh();
      return;
    }

    toast.error("Bạn không còn quyền truy cập bảng này.");
    cardModal.onClose();
    router.push(`/organization/${payload.orgId}`);
  }, [boardId, cardModal, currentUserId, processBoardEvent, router]);

  const handleBoardMemberRemoved = useCallback((payload: BoardMemberRemovedPayload) => {
    if (payload.boardId !== boardId || !processBoardEvent(payload.eventId)) {
      return;
    }

    if (payload.targetUserId === currentUserId) {
      toast.error("Bạn không còn quyền truy cập bảng này.");
      cardModal.onClose();
      router.push(`/organization/${payload.orgId}`);
      return;
    }

    if (payload.actorUserId !== currentUserId) {
      router.refresh();
    }
  }, [boardId, cardModal, currentUserId, processBoardEvent, router]);

  const handleCardDeleted = useCallback((payload: CardDeletedPayload) => {
    if (payload.boardId !== boardId || !processBoardEvent(payload.eventId)) {
      return;
    }

    if (cardModal.id === payload.cardId) {
      cardModal.onClose();
      toast.error("Thẻ này đã bị xóa.");
    }

    if (payload.actorUserId !== currentUserId) {
      router.refresh();
    }
  }, [boardId, cardModal, currentUserId, processBoardEvent, router]);

  const handleChecklistSync = useCallback((
    payload:
      | ChecklistPayload
      | ChecklistItemPayload
      | ChecklistItemReorderedPayload
      | ChecklistItemMovedPayload,
  ) => {
    if (payload.boardId !== boardId || !processBoardEvent(payload.eventId)) {
      return;
    }

    if (payload.actorUserId === currentUserId) {
      return;
    }

    if (cardModal.isOpen && cardModal.id === payload.cardId) {
      payload.invalidate.forEach(({ queryKey }) => {
        queryClient.invalidateQueries({ queryKey });
      });
    }

    router.refresh();
  }, [boardId, cardModal.id, cardModal.isOpen, currentUserId, processBoardEvent, queryClient, router]);

  const handleLabelSync = useCallback((
    payload: LabelPayload | CardLabelPayload,
  ) => {
    if (payload.boardId !== boardId || !processBoardEvent(payload.eventId)) {
      return;
    }

    if (payload.actorUserId === currentUserId) {
      return;
    }

    if (cardModal.isOpen) {
      if (!payload.cardId || cardModal.id === payload.cardId) {
        queryClient.invalidateQueries({ queryKey: ["card", cardModal.id] });
      }
    }

    router.refresh();
  }, [boardId, cardModal.id, cardModal.isOpen, currentUserId, processBoardEvent, queryClient, router]);

  const handleAttachmentReordered = useCallback((payload: AttachmentReorderedPayload) => {
    if (payload.boardId !== boardId || !processBoardEvent(payload.eventId)) {
      return;
    }

    if (payload.actorUserId === currentUserId) {
      return;
    }

    if (cardModal.isOpen && cardModal.id === payload.cardId) {
      queryClient.invalidateQueries({ queryKey: ["card", payload.cardId] });
    }
  }, [boardId, cardModal.id, cardModal.isOpen, currentUserId, processBoardEvent, queryClient]);

  const handleCommentCountUpdated = useCallback((payload: CardCommentCountUpdatedPayload) => {
    if (payload.boardId !== boardId || !processBoardEvent(payload.eventId)) {
      return;
    }

    if (payload.actorUserId === currentUserId) {
      return;
    }

    setOrderedData((prevData) =>
      prevData.map((list) => ({
        ...list,
        cards: list.cards.map((card) =>
          card.id === payload.cardId
            ? {
                ...card,
                _count: {
                  ...card._count,
                  attachments: card._count?.attachments ?? 0,
                  comments: Math.max(
                    (card._count?.comments || 0) + payload.delta,
                    0,
                  ),
                },
              }
            : card
        ),
      }))
    );
  }, [boardId, currentUserId, processBoardEvent, setOrderedData]);

  return {
    onBoardCardSync: handleBoardCardSync,
    onBoardDeleted: handleBoardDeleted,
    onAccessRevoked: handleAccessRevoked,
    onBoardMemberRemoved: handleBoardMemberRemoved,
    onCardDeleted: handleCardDeleted,
    onChecklistSync: handleChecklistSync,
    onLabelSync: handleLabelSync,
    onAttachmentReordered: handleAttachmentReordered,
    onCommentCountUpdated: handleCommentCountUpdated,
  };
};
