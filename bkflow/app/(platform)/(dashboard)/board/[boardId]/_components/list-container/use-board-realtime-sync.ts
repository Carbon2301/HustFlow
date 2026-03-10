"use client";

import { Dispatch, SetStateAction, useCallback, useRef } from "react";
import { toast } from "sonner";
import { QueryClient } from "@tanstack/react-query";

import { CardWithAssignees, CardWithList, ListWithCards } from "@/types";
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
  orderedData: ListWithCards[];
  setOrderedData: Dispatch<SetStateAction<ListWithCards[]>>;
};

type BoardCardApiResponse = CardWithList & {
  _count?: {
    comments: number;
    attachments: number;
  };
};

const toDate = (value: Date | string | null | undefined) => {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value : new Date(value);
};

const normalizeCardForBoard = (card: BoardCardApiResponse): CardWithAssignees => ({
  ...card,
  createdAt: toDate(card.createdAt) ?? new Date(),
  updatedAt: toDate(card.updatedAt) ?? new Date(),
  startDate: toDate(card.startDate),
  dueDate: toDate(card.dueDate),
  reminderSetAt: toDate(card.reminderSetAt),
  archivedAt: toDate(card.archivedAt),
  assignees: card.assignees ?? [],
  labels: card.labels ?? [],
  checklists: card.checklists?.map((checklist) => ({
    items: checklist.items.map((item) => ({
      isCompleted: item.isCompleted,
    })),
  })) ?? [],
  checklistProgress: {
    total: card.checklists?.reduce((acc, checklist) => acc + checklist.items.length, 0) ?? 0,
    completed: card.checklists?.reduce(
      (acc, checklist) => acc + checklist.items.filter((item) => item.isCompleted).length,
      0,
    ) ?? 0,
  },
  _count: card._count ?? {
    comments: 0,
    attachments: card.attachments?.length ?? 0,
  },
});

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

export const useBoardRealtimeSync = ({
  boardId,
  currentUserId,
  cardModal,
  router,
  queryClient,
  orderedData,
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

  const patchCardFromFetch = useCallback(async (cardId: string) => {
    try {
      const fetchedCard = await fetchCardForBoard(cardId);

      if (!fetchedCard) {
        setOrderedData((prevData) =>
          prevData.map((list) => ({
            ...list,
            cards: list.cards.filter((card) => card.id !== cardId),
          })),
        );

        return true;
      }

      let existingCard: CardWithAssignees | undefined;
      for (const list of orderedData) {
        existingCard = list.cards.find((card) => card.id === fetchedCard.id);
        if (existingCard) {
          break;
        }
      }

      if (existingCard) {
        if (new Date(fetchedCard.updatedAt).getTime() < new Date(existingCard.updatedAt).getTime()) {
          return true;
        }

        setOrderedData((prevData) =>
          prevData.map((list) => ({
            ...list,
            cards: list.cards.map((card) =>
              card.id === fetchedCard.id ? fetchedCard : card,
            ),
          })),
        );
        return true;
      }

      const hasDestinationList = orderedData.some((list) => list.id === fetchedCard.listId);

      if (!hasDestinationList) {
        return false;
      }

      setOrderedData((prevData) =>
        prevData.map((list) =>
          list.id === fetchedCard.listId
            ? {
                ...list,
                cards: [...list.cards, fetchedCard].sort((a, b) => a.order - b.order),
              }
            : list,
        ),
      );

      return true;
    } catch {
      return false;
    }
  }, [orderedData, setOrderedData]);

  const handleCardUpdated = useCallback(async (payload: CardUpdatedPayload) => {
    if (payload.boardId !== boardId || !processBoardEvent(payload.eventId)) {
      return;
    }

    if (payload.actorUserId === currentUserId) {
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
    } else if (!await patchCardFromFetch(payload.cardId)) {
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
    currentUserId,
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

    if (payload.actorUserId === currentUserId) {
      return;
    }

    if (!await patchCardFromFetch(payload.cardId)) {
      router.refresh();
    }
  }, [boardId, currentUserId, patchCardFromFetch, processBoardEvent, router]);

  const handleCardMemberAssigned = useCallback(async (payload: CardMemberAssignedPayload) => {
    if (payload.boardId !== boardId || !processBoardEvent(payload.eventId)) {
      return;
    }

    if (payload.actorUserId === currentUserId) {
      return;
    }

    if (!await patchCardFromFetch(payload.cardId)) {
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
    currentUserId,
    patchCardFromFetch,
    processBoardEvent,
    queryClient,
    router,
  ]);

  const handleCardMemberUnassigned = useCallback((payload: CardMemberUnassignedPayload) => {
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
                assignees: card.assignees.filter(
                  (assignee) => assignee.boardMemberId !== payload.boardMemberId,
                ),
              }
            : card,
        ),
      })),
    );

    if (cardModal.isOpen && cardModal.id === payload.cardId) {
      payload.invalidate.forEach(({ queryKey }) => {
        queryClient.invalidateQueries({ queryKey });
      });
    }
  }, [
    boardId,
    cardModal.id,
    cardModal.isOpen,
    currentUserId,
    processBoardEvent,
    queryClient,
    setOrderedData,
  ]);

  const handleListUpdated = useCallback((payload: ListUpdatedPayload) => {
    if (payload.boardId !== boardId || !processBoardEvent(payload.eventId)) {
      return;
    }

    if (payload.actorUserId === currentUserId) {
      return;
    }

    if (!payload.title) {
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
  }, [boardId, currentUserId, processBoardEvent, router, setOrderedData]);

  const handleListDeleted = useCallback((payload: ListDeletedPayload) => {
    if (payload.boardId !== boardId || !processBoardEvent(payload.eventId)) {
      return;
    }

    if (payload.actorUserId === currentUserId) {
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
  }, [boardId, cardModal, currentUserId, processBoardEvent, setOrderedData]);

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

    if (payload.actorUserId === currentUserId) {
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
        router.refresh();
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
        router.refresh();
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
        router.refresh();
      }

      return;
    }

    router.refresh();
  }, [boardId, currentUserId, processBoardEvent, router, setOrderedData]);

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
      if (payload.archived) {
        toast.error("Thẻ này đã được lưu trữ.");
      } else {
        toast.error("Thẻ này đã bị xóa.");
      }
    }

    if (payload.actorUserId !== currentUserId) {
      setOrderedData((prevData) =>
        prevData.map((list) => ({
          ...list,
          cards: list.cards.filter((card) => card.id !== payload.cardId),
        })),
      );
    }
  }, [boardId, cardModal, currentUserId, processBoardEvent, setOrderedData]);

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
            : card,
        ),
      })),
    );
  }, [boardId, currentUserId, processBoardEvent, setOrderedData]);

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
