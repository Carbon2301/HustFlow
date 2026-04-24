"use client";

import { Dispatch, SetStateAction, useCallback, useRef } from "react";
import { toast } from "sonner";
import { QueryClient } from "@tanstack/react-query";

import { CardWithAssignees, ListWithCards } from "@/types";
import { debugBoardRealtime } from "@/lib/realtime/debug";
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
import {
  normalizeCardForBoard,
  toDate,
  type BoardCardApiResponse,
} from "../_lib/realtime-card-normalizers";

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

const reorderListsByIds = (
  lists: ListWithCards[],
  orderedListIds: string[],
) => {
  if (orderedListIds.length !== lists.length) {
    return { applied: false, data: lists };
  }

  const listById = new Map(lists.map((list) => [list.id, list]));
  const orderedLists = orderedListIds.map((listId, index) => {
    const list = listById.get(listId);

    if (!list) {
      return null;
    }

    return list.order === index ? list : { ...list, order: index };
  });

  if (orderedLists.some((list) => !list)) {
    return { applied: false, data: lists };
  }

  return { applied: true, data: orderedLists as ListWithCards[] };
};

const reorderCardsByIds = (
  cards: CardWithAssignees[],
  orderedCardIds: string[],
  listId: string,
) => {
  if (orderedCardIds.length !== cards.length) {
    return null;
  }

  const cardById = new Map(cards.map((card) => [card.id, card]));
  const orderedCards = orderedCardIds.map((cardId, index) => {
    const card = cardById.get(cardId);

    if (!card) {
      return null;
    }

    if (card.order === index && card.listId === listId) {
      return card;
    }

    return {
      ...card,
      order: index,
      listId,
    };
  });

  if (orderedCards.some((card) => !card)) {
    return null;
  }

  return orderedCards as CardWithAssignees[];
};

const reorderCardsInList = (
  lists: ListWithCards[],
  listId: string,
  orderedCardIds: string[],
) => {
  let applied = false;

  const data = lists.map((list) => {
    if (list.id !== listId) {
      return list;
    }

    const cards = reorderCardsByIds(list.cards, orderedCardIds, listId);

    if (!cards) {
      return list;
    }

    applied = true;
    return {
      ...list,
      cards,
    };
  });

  return { applied, data };
};

const moveCardBetweenLists = (
  lists: ListWithCards[],
  cardId: string,
  sourceListId: string,
  destinationListId: string,
  sourceOrderedCardIds: string[],
  destinationOrderedCardIds: string[],
) => {
  const sourceList = lists.find((list) => list.id === sourceListId);
  const destinationList = lists.find((list) => list.id === destinationListId);
  const movedCard = sourceList?.cards.find((card) => card.id === cardId);

  if (!sourceList || !destinationList || !movedCard) {
    return { applied: false, data: lists };
  }

  const sourceCards = reorderCardsByIds(
    sourceList.cards.filter((card) => card.id !== cardId),
    sourceOrderedCardIds,
    sourceListId,
  );
  const destinationBaseCards = destinationList.cards.filter((card) => card.id !== cardId);
  const destinationCards = reorderCardsByIds(
    [
      ...destinationBaseCards,
      {
        ...movedCard,
        listId: destinationListId,
      },
    ],
    destinationOrderedCardIds,
    destinationListId,
  );

  if (!sourceCards || !destinationCards) {
    return { applied: false, data: lists };
  }

  return {
    applied: true,
    data: lists.map((list) => {
      if (list.id === sourceListId) {
        return {
          ...list,
          cards: sourceCards,
        };
      }

      if (list.id === destinationListId) {
        return {
          ...list,
          cards: destinationCards,
        };
      }

      return list;
    }),
  };
};

const fetchCardForBoard = async (cardId: string) => {
  const response = await fetch(`/api/cards/${cardId}`, {
    cache: "no-store",
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error("CARD_FETCH_FAILED");
  }

  return normalizeCardForBoard(await response.json() as BoardCardApiResponse);
};

const isMatchingTemporaryCard = (
  card: CardWithAssignees,
  fetchedCard: CardWithAssignees,
) =>
  card.id.startsWith("temp-card-") &&
  card.listId === fetchedCard.listId &&
  card.title === fetchedCard.title;

export const useBoardRealtimeSync = ({
  boardId,
  currentUserId,
  cardModal,
  router,
  queryClient,
  setOrderedData,
}: UseBoardRealtimeSyncOptions) => {
  const processedCardEventIdsRef = useRef<Set<string>>(new Set());

  const processBoardEvent = useCallback((
    eventId: string,
    details?: {
      boardId?: string;
      cardId?: string;
      listId?: string;
      reason?: string;
    },
  ) => {
    if (processedCardEventIdsRef.current.has(eventId)) {
      debugBoardRealtime("event ignored", {
        eventId,
        ...details,
        reason: details?.reason ?? "duplicate event",
      });
      return false;
    }

    processedCardEventIdsRef.current.add(eventId);
    return true;
  }, []);

  const patchCardFromFetch = useCallback(async (cardId: string, reason: string) => {
    try {
      const fetchedCard = await fetchCardForBoard(cardId);
      let applied = false;

      if (!fetchedCard) {
        setOrderedData((prevData) =>
          prevData.map((list) => ({
            ...list,
            cards: list.cards.filter((card) => card.id !== cardId),
          })),
        );

        debugBoardRealtime("patch applied", {
          boardId,
          cardId,
          reason: `${reason}: card missing, removed locally`,
        });
        return true;
      }

      setOrderedData((prevData) => {
        const existingCard = prevData
          .flatMap((list) => list.cards)
          .find((card) => card.id === fetchedCard.id);
        const hasDestinationList = prevData.some((list) => list.id === fetchedCard.listId);

        if (!hasDestinationList) {
          return prevData;
        }

        if (
          existingCard &&
          new Date(fetchedCard.updatedAt).getTime() <
            new Date(existingCard.updatedAt).getTime()
        ) {
          applied = true;
          return prevData;
        }

        applied = true;

        return prevData.map((list) => {
          const cardsWithoutFetched = list.cards.filter((card) => card.id !== fetchedCard.id);

          if (list.id !== fetchedCard.listId) {
            return cardsWithoutFetched.length === list.cards.length
              ? list
              : {
                  ...list,
                  cards: cardsWithoutFetched,
                };
          }

          const cardsWithoutTemporaryMatch = cardsWithoutFetched.filter(
            (card) => !isMatchingTemporaryCard(card, fetchedCard),
          );

          return {
            ...list,
            cards: [...cardsWithoutTemporaryMatch, fetchedCard].sort((a, b) => a.order - b.order),
          };
        });
      });

      if (!applied) {
        debugBoardRealtime("fallback fetch/refresh", {
          boardId,
          cardId,
          reason: `${reason}: destination list missing`,
        });
        return false;
      }

      debugBoardRealtime("patch applied", {
        boardId,
        cardId,
        listId: fetchedCard.listId,
        reason,
      });
      return true;
    } catch {
      debugBoardRealtime("fallback fetch/refresh", {
        boardId,
        cardId,
        reason: `${reason}: card fetch failed`,
      });
      return false;
    }
  }, [boardId, setOrderedData]);

  const handleCardUpdated = useCallback(async (payload: CardUpdatedPayload) => {
    if (payload.boardId !== boardId || !processBoardEvent(payload.eventId)) {
      return;
    }

    const realtimeCard = payload.card;

    if (realtimeCard) {
      setOrderedData((prevData) =>
        prevData.map((list) => ({
          ...list,
          cards: list.cards.map((card) =>
            card.id === payload.cardId
              ? {
                  ...card,
                  title: realtimeCard.title,
                  description: realtimeCard.description,
                  startDate: toDate(realtimeCard.startDate),
                  dueDate: toDate(realtimeCard.dueDate),
                  isCompleted: realtimeCard.isCompleted,
                  reminder: realtimeCard.reminder,
                  reminderSetAt: toDate(realtimeCard.reminderSetAt),
                  updatedAt: toDate(payload.updatedAt) ?? card.updatedAt,
                }
              : card,
          ),
        })),
      );
      debugBoardRealtime("patch applied", {
        boardId,
        cardId: payload.cardId,
        reason: "card updated",
      });
    } else if (!await patchCardFromFetch(payload.cardId, "card updated payload missing card")) {
      debugBoardRealtime("fallback fetch/refresh", {
        boardId,
        cardId: payload.cardId,
        reason: "card updated could not patch from fetch",
      });
      router.refresh();
      return;
    }

    if (cardModal.isOpen && cardModal.id === payload.cardId) {
      payload.invalidate.forEach(({ queryKey }) => {
        queryClient.invalidateQueries({ queryKey });
      });
    }
  }, [
    boardId,
    cardModal.id,
    cardModal.isOpen,
    patchCardFromFetch,
    processBoardEvent,
    queryClient,
    router,
    setOrderedData,
  ]);

  const handleCardCreated = useCallback(async (payload: CardCreatedPayload) => {
    if (payload.boardId !== boardId || !processBoardEvent(payload.eventId)) {
      return;
    }

    if (!await patchCardFromFetch(payload.cardId, "card created")) {
      debugBoardRealtime("fallback fetch/refresh", {
        boardId,
        cardId: payload.cardId,
        reason: "card created could not patch from fetch",
      });
      router.refresh();
    }
  }, [boardId, patchCardFromFetch, processBoardEvent, router]);

  const handleCardMemberAssigned = useCallback(async (payload: CardMemberAssignedPayload) => {
    if (payload.boardId !== boardId || !processBoardEvent(payload.eventId)) {
      return;
    }

    if (!await patchCardFromFetch(payload.cardId, "card member assigned")) {
      debugBoardRealtime("fallback fetch/refresh", {
        boardId,
        cardId: payload.cardId,
        reason: "card member assigned could not patch from fetch",
      });
      router.refresh();
      return;
    }

    if (cardModal.isOpen && cardModal.id === payload.cardId) {
      payload.invalidate.forEach(({ queryKey }) => {
        queryClient.invalidateQueries({ queryKey });
      });
    }
  }, [
    boardId,
    cardModal.id,
    cardModal.isOpen,
    patchCardFromFetch,
    processBoardEvent,
    queryClient,
    router,
  ]);

  const handleCardMemberUnassigned = useCallback((payload: CardMemberUnassignedPayload) => {
    if (payload.boardId !== boardId || !processBoardEvent(payload.eventId)) {
      return;
    }

    setOrderedData((prevData) =>
      prevData.map((list) => ({
        ...list,
        cards: list.cards.map((card) =>
          card.id === payload.cardId
            ? {
                ...card,
                assignees: card.assignees.filter(
                  (assignee) => assignee.boardMemberId !== payload.boardMemberId,
                ),
              }
            : card,
        ),
      })),
    );
    debugBoardRealtime("patch applied", {
      boardId,
      cardId: payload.cardId,
      reason: "card member unassigned",
    });

    if (cardModal.isOpen && cardModal.id === payload.cardId) {
      payload.invalidate.forEach(({ queryKey }) => {
        queryClient.invalidateQueries({ queryKey });
      });
    }
  }, [
    boardId,
    cardModal.id,
    cardModal.isOpen,
    processBoardEvent,
    queryClient,
    setOrderedData,
  ]);

  const handleListUpdated = useCallback((payload: ListUpdatedPayload) => {
    if (payload.boardId !== boardId || !processBoardEvent(payload.eventId)) {
      return;
    }

    if (!payload.title) {
      debugBoardRealtime("fallback fetch/refresh", {
        boardId,
        listId: payload.listId,
        reason: "list updated payload missing title",
      });
      router.refresh();
      return;
    }

    setOrderedData((prevData) =>
      prevData.map((list) =>
        list.id === payload.listId
          ? {
              ...list,
              title: payload.title ?? list.title,
              updatedAt: toDate(payload.updatedAt) ?? list.updatedAt,
            }
          : list,
      ),
    );
    debugBoardRealtime("patch applied", {
      boardId,
      listId: payload.listId,
      reason: "list updated",
    });
  }, [boardId, processBoardEvent, router, setOrderedData]);

  const handleListDeleted = useCallback((payload: ListDeletedPayload) => {
    if (payload.boardId !== boardId || !processBoardEvent(payload.eventId)) {
      return;
    }

    setOrderedData((prevData) => {
      const targetList = prevData.find((list) => list.id === payload.listId);
      if (targetList && cardModal.isOpen && cardModal.id) {
        const isCardInDeletedList = targetList.cards.some((card) => card.id === cardModal.id);
        if (isCardInDeletedList) {
          cardModal.onClose();
          if (payload.archived) {
            toast.error("Danh sách chứa thẻ này đã được lưu trữ.");
          } else {
            toast.error("Danh sách chứa thẻ này đã bị xóa.");
          }
        }
      }
      return prevData.filter((list) => list.id !== payload.listId);
    });
    debugBoardRealtime("patch applied", {
      boardId,
      listId: payload.listId,
      reason: "list deleted",
    });
  }, [boardId, cardModal, processBoardEvent, setOrderedData]);

  const handleBoardCardSync = useCallback((
    payload:
      | ListCreatedPayload
      | ListReorderedPayload
      | BoardUpdatedPayload
      | BoardMemberAddedPayload
      | BoardMemberRoleUpdatedPayload
      | CardReorderedPayload
      | CardMovedPayload,
  ) => {
    if (payload.boardId !== boardId || !processBoardEvent(payload.eventId)) {
      return;
    }

    if ("orderedListIds" in payload && payload.orderedListIds) {
      let applied = false;

      setOrderedData((prevData) => {
        const result = reorderListsByIds(prevData, payload.orderedListIds!);
        applied = result.applied;
        return result.data;
      });

      if (!applied) {
        debugBoardRealtime("fallback fetch/refresh", {
          boardId,
          reason: "list reorder ids did not match local state",
        });
        router.refresh();
      } else {
        debugBoardRealtime("patch applied", {
          boardId,
          reason: "list reordered",
        });
      }

      return;
    }

    if ("orderedCardIds" in payload && payload.listId && payload.orderedCardIds) {
      let applied = false;

      setOrderedData((prevData) => {
        const result = reorderCardsInList(prevData, payload.listId!, payload.orderedCardIds!);
        applied = result.applied;
        return result.data;
      });

      if (!applied) {
        debugBoardRealtime("fallback fetch/refresh", {
          boardId,
          listId: payload.listId,
          reason: "card reorder ids did not match local state",
        });
        router.refresh();
      } else {
        debugBoardRealtime("patch applied", {
          boardId,
          listId: payload.listId,
          reason: "card reordered",
        });
      }

      return;
    }

    if (
      "sourceOrderedCardIds" in payload &&
      payload.cardId &&
      payload.sourceListId &&
      payload.destinationListId &&
      payload.sourceOrderedCardIds &&
      payload.destinationOrderedCardIds
    ) {
      let applied = false;

      setOrderedData((prevData) => {
        const result = moveCardBetweenLists(
          prevData,
          payload.cardId!,
          payload.sourceListId!,
          payload.destinationListId!,
          payload.sourceOrderedCardIds!,
          payload.destinationOrderedCardIds!,
        );
        applied = result.applied;
        return result.data;
      });

      if (!applied) {
        debugBoardRealtime("fallback fetch/refresh", {
          boardId,
          cardId: payload.cardId,
          reason: "card move ids did not match local state",
        });
        router.refresh();
      } else {
        debugBoardRealtime("patch applied", {
          boardId,
          cardId: payload.cardId,
          listId: payload.destinationListId,
          reason: "card moved",
        });
      }

      return;
    }

    debugBoardRealtime("fallback fetch/refresh", {
      boardId,
      reason: "board event payload requires server refresh",
    });
    router.refresh();
  }, [boardId, processBoardEvent, router, setOrderedData]);

  const handleBoardDeleted = useCallback((payload: BoardDeletedPayload) => {
    if (payload.boardId !== boardId || !processBoardEvent(payload.eventId)) {
      return;
    }

    toast.error("Bảng này đã bị xóa.");
    cardModal.onClose();
    router.push(`/organization/${payload.orgId}`);
  }, [boardId, cardModal, processBoardEvent, router]);

  const handleAccessRevoked = useCallback((payload: BoardAccessRevokedPayload) => {
    if (payload.boardId !== boardId || !processBoardEvent(payload.eventId)) {
      return;
    }

    if (payload.targetUserId !== currentUserId) {
      debugBoardRealtime("fallback fetch/refresh", {
        boardId,
        reason: "access changed for another board member",
      });
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

    debugBoardRealtime("fallback fetch/refresh", {
      boardId,
      reason: "board member removed",
    });
    router.refresh();
  }, [boardId, cardModal, currentUserId, processBoardEvent, router]);

  const handleCardDeleted = useCallback((payload: CardDeletedPayload) => {
    if (payload.boardId !== boardId || !processBoardEvent(payload.eventId)) {
      return;
    }

    if (cardModal.id === payload.cardId) {
      cardModal.onClose();
      if (payload.archived) {
        toast.error("Thẻ này đã được lưu trữ.");
      } else {
        toast.error("Thẻ này đã bị xóa.");
      }
    }

    setOrderedData((prevData) =>
      prevData.map((list) => ({
        ...list,
        cards: list.cards.filter((card) => card.id !== payload.cardId),
      })),
    );
    debugBoardRealtime("patch applied", {
      boardId,
      cardId: payload.cardId,
      reason: "card deleted",
    });
  }, [boardId, cardModal, processBoardEvent, setOrderedData]);

  const handleChecklistSync = useCallback(async (
    payload:
      | ChecklistPayload
      | ChecklistItemPayload
      | ChecklistItemReorderedPayload
      | ChecklistItemMovedPayload,
  ) => {
    if (payload.boardId !== boardId || !processBoardEvent(payload.eventId)) {
      return;
    }

    if (!await patchCardFromFetch(payload.cardId, "checklist sync")) {
      router.refresh();
    }

    if (cardModal.isOpen && cardModal.id === payload.cardId) {
      payload.invalidate.forEach(({ queryKey }) => {
        queryClient.invalidateQueries({ queryKey });
      });
    }
  }, [boardId, cardModal.id, cardModal.isOpen, patchCardFromFetch, processBoardEvent, queryClient, router]);

  const handleLabelSync = useCallback(async (
    payload: LabelPayload | CardLabelPayload,
  ) => {
    if (payload.boardId !== boardId || !processBoardEvent(payload.eventId)) {
      return;
    }

    if (payload.cardId) {
      if (!await patchCardFromFetch(payload.cardId, "label sync")) {
        router.refresh();
      }
    } else {
      debugBoardRealtime("fallback fetch/refresh", {
        boardId,
        reason: "label payload has no card id",
      });
      router.refresh();
    }

    if (cardModal.isOpen) {
      if (!payload.cardId || cardModal.id === payload.cardId) {
        queryClient.invalidateQueries({ queryKey: ["card", cardModal.id] });
      }
    }
  }, [boardId, cardModal.id, cardModal.isOpen, patchCardFromFetch, processBoardEvent, queryClient, router]);

  const handleAttachmentReordered = useCallback((payload: AttachmentReorderedPayload) => {
    if (payload.boardId !== boardId || !processBoardEvent(payload.eventId)) {
      return;
    }

    if (cardModal.isOpen && cardModal.id === payload.cardId) {
      queryClient.invalidateQueries({ queryKey: ["card", payload.cardId] });
    }
  }, [boardId, cardModal.id, cardModal.isOpen, processBoardEvent, queryClient]);

  const handleCommentCountUpdated = useCallback((payload: CardCommentCountUpdatedPayload) => {
    if (payload.boardId !== boardId || !processBoardEvent(payload.eventId)) {
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
            : card,
        ),
      })),
    );
    debugBoardRealtime("patch applied", {
      boardId,
      cardId: payload.cardId,
      reason: "comment count updated",
    });
  }, [boardId, processBoardEvent, setOrderedData]);

  return {
    onBoardCardSync: handleBoardCardSync,
    onCardUpdated: handleCardUpdated,
    onCardCreated: handleCardCreated,
    onCardMemberAssigned: handleCardMemberAssigned,
    onCardMemberUnassigned: handleCardMemberUnassigned,
    onListUpdated: handleListUpdated,
    onListDeleted: handleListDeleted,
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
