"use client";

import { toast } from "sonner";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DragDropContext, Droppable, type DropResult } from "@hello-pangea/dnd";
import { BoardMember, BoardMemberRole } from "@prisma/client";

import { CardWithAssignees, ListWithCards } from "@/types";
import { useAction } from "@/hooks/use-action";
import { emptyBoardFilters, useBoardFilters, BoardFilterState } from "@/hooks/use-board-filters";
import { updateListOrder } from "@/actions/update-list-order";
import { updateCardOrder } from "@/actions/update-card-order";
import { useRealtimeChannel } from "@/hooks/use-realtime-channel";
import { useCardModal } from "@/hooks/use-card-modal";
import { realtimeChannels } from "@/lib/realtime/channels";
import { isRealtimeClientConfigured } from "@/lib/realtime/client";
import { REALTIME_EVENTS } from "@/lib/realtime/events";
import type {
  BoardAccessRevokedPayload,
  BoardDeletedPayload,
  BoardMemberAddedPayload,
  BoardMemberRemovedPayload,
  BoardMemberRoleUpdatedPayload,
  BoardUpdatedPayload,
  CardCommentCountUpdatedPayload,
  CardCreatedPayload,
  CardDeletedPayload,
  CardMemberAssignedPayload,
  CardMemberUnassignedPayload,
  CardMovedPayload,
  CardReorderedPayload,
  CardUpdatedPayload,
  ListCreatedPayload,
  ListDeletedPayload,
  ListReorderedPayload,
  ListUpdatedPayload,
} from "@/lib/realtime/types";

import { ListForm } from "./list-form";
import { ListItem } from "./list-item";

interface ListContainerProps {
  data: ListWithCards[];
  boardId: string;
  boardMembers: BoardMember[];
  currentUserId: string;
  currentMemberRole: BoardMemberRole;
};

function reorder<T>(list: T[], startIndex: number, endIndex: number) {
  const result = Array.from(list);
  const [removed] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, removed);

  return result;
};

const cardMatchesFilters = (
  card: CardWithAssignees,
  filters: BoardFilterState,
  currentBoardMemberId: string | undefined,
) => {
  const {
    selectedMemberIds,
    myWorkEnabled,
    noMembersEnabled,
    completedEnabled,
    notCompletedEnabled,
    selectedDueDateFilters,
  } = filters;

  // 1. Member Filters
  const hasMemberFilter = selectedMemberIds.length > 0 || myWorkEnabled || noMembersEnabled;
  if (hasMemberFilter) {
    let match = false;
    if (noMembersEnabled && card.assignees.length === 0) {
      match = true;
    }
    if (myWorkEnabled && currentBoardMemberId && card.assignees.some((a) => a.boardMemberId === currentBoardMemberId)) {
      match = true;
    }
    if (selectedMemberIds.length > 0 && card.assignees.some((a) => selectedMemberIds.includes(a.boardMemberId))) {
      match = true;
    }
    if (!match) return false;
  }

  // 2. Card Status Filters
  const hasStatusFilter = completedEnabled || notCompletedEnabled;
  if (hasStatusFilter) {
    let match = false;
    if (completedEnabled && card.isCompleted) {
      match = true;
    }
    if (notCompletedEnabled && !card.isCompleted) {
      match = true;
    }
    if (!match) return false;
  }

  // 3. Due Date Filters
  const hasDueDateFilter = selectedDueDateFilters.length > 0;
  if (hasDueDateFilter) {
    let match = false;
    const now = new Date();

    selectedDueDateFilters.forEach((filterType) => {
      if (filterType === "no-due" && !card.dueDate) {
        match = true;
      }

      if (card.dueDate) {
        const dueDate = new Date(card.dueDate);
        const isPast = dueDate.getTime() < now.getTime();

        if (filterType === "overdue" && isPast && !card.isCompleted) {
          match = true;
        }

        if (filterType === "next-hour") {
          const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
          if (dueDate.getTime() >= now.getTime() && dueDate.getTime() <= oneHourFromNow.getTime()) {
            match = true;
          }
        }

        if (filterType === "tomorrow") {
          const endOfTomorrow = new Date(now);
          endOfTomorrow.setDate(now.getDate() + 1);
          endOfTomorrow.setHours(23, 59, 59, 999);

          if (dueDate.getTime() >= now.getTime() && dueDate.getTime() <= endOfTomorrow.getTime()) {
            match = true;
          }
        }

        if (filterType === "next-week") {
          const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
          if (dueDate.getTime() >= now.getTime() && dueDate.getTime() <= sevenDaysFromNow.getTime()) {
            match = true;
          }
        }

        if (filterType === "next-month") {
          const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
          if (dueDate.getTime() >= now.getTime() && dueDate.getTime() <= thirtyDaysFromNow.getTime()) {
            match = true;
          }
        }
      }
    });

    if (!match) return false;
  }

  // 4. Label Filters
  const { selectedLabelIds = [], noLabelsEnabled = false } = filters;
  const hasLabelFilter = selectedLabelIds.length > 0 || noLabelsEnabled;
  if (hasLabelFilter) {
    let match = false;
    if (noLabelsEnabled && (!card.labels || card.labels.length === 0)) {
      match = true;
    }
    if (selectedLabelIds.length > 0 && card.labels && card.labels.some((cl) => selectedLabelIds.includes(cl.labelId))) {
      match = true;
    }
    if (!match) return false;
  }

  return true;
};

const getDestinationIndex = ({
  actualCards,
  visibleCards,
  destinationIndex,
}: {
  actualCards: CardWithAssignees[];
  visibleCards: CardWithAssignees[];
  destinationIndex: number;
}) => {
  const targetVisibleCard = visibleCards[destinationIndex];

  if (targetVisibleCard) {
    return actualCards.findIndex((card) => card.id === targetVisibleCard.id);
  }

  const lastVisibleCard = visibleCards[destinationIndex - 1];

  if (lastVisibleCard) {
    const lastVisibleIndex = actualCards.findIndex(
      (card) => card.id === lastVisibleCard.id,
    );

    return lastVisibleIndex + 1;
  }

  return actualCards.length;
};

export const ListContainer = ({
  data,
  boardId,
  boardMembers,
  currentUserId,
}: ListContainerProps) => {
  const router = useRouter();
  const cardModal = useCardModal();
  const [orderedData, setOrderedData] = useState(data);
  const processedCardEventIdsRef = useRef<Set<string>>(new Set());
  const filters = useBoardFilters((state) =>
    state.filtersByBoardId[boardId] ?? emptyBoardFilters,
  );
  const { selectedMemberIds, myWorkEnabled } = filters;

  const { execute: executeUpdateListOrder } = useAction(updateListOrder, {
    onSuccess: () => {
      toast.success("Đã sắp xếp lại thứ tự danh sách");
    },
    onError: (error) => {
      toast.error(error);
    },
  });

  const { execute: executeUpdateCardOrder } = useAction(updateCardOrder, {
    onSuccess: () => {
      toast.success("Đã sắp xếp lại thứ tự thẻ");
    },
    onError: (error) => {
      toast.error(error);
    },
  });

  useEffect(() => {
    setOrderedData(data);
  }, [data]);

  const channelName = realtimeChannels.board(boardId);
  const enabled = isRealtimeClientConfigured();

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

  useRealtimeChannel({
    channelName,
    event: REALTIME_EVENTS.CARD_COMMENT_COUNT_UPDATED,
    onEvent: (payload: CardCommentCountUpdatedPayload) => {
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
    },
    enabled,
  });

  useRealtimeChannel({
    channelName,
    event: REALTIME_EVENTS.BOARD_UPDATED,
    onEvent: handleBoardCardSync,
    enabled,
  });

  useRealtimeChannel({
    channelName,
    event: REALTIME_EVENTS.CARD_UPDATED,
    onEvent: handleBoardCardSync,
    enabled,
  });

  useRealtimeChannel({
    channelName,
    event: REALTIME_EVENTS.CARD_REORDERED,
    onEvent: handleBoardCardSync,
    enabled,
  });

  useRealtimeChannel({
    channelName,
    event: REALTIME_EVENTS.CARD_MOVED,
    onEvent: handleBoardCardSync,
    enabled,
  });

  useRealtimeChannel({
    channelName,
    event: REALTIME_EVENTS.CARD_MEMBER_ASSIGNED,
    onEvent: handleBoardCardSync,
    enabled,
  });

  useRealtimeChannel({
    channelName,
    event: REALTIME_EVENTS.CARD_MEMBER_UNASSIGNED,
    onEvent: handleBoardCardSync,
    enabled,
  });

  useRealtimeChannel({
    channelName,
    event: REALTIME_EVENTS.BOARD_DELETED,
    onEvent: handleBoardDeleted,
    enabled,
  });

  useRealtimeChannel({
    channelName,
    event: REALTIME_EVENTS.BOARD_ACCESS_REVOKED,
    onEvent: handleAccessRevoked,
    enabled,
  });

  useRealtimeChannel({
    channelName,
    event: REALTIME_EVENTS.BOARD_MEMBER_ADDED,
    onEvent: handleBoardCardSync,
    enabled,
  });

  useRealtimeChannel({
    channelName,
    event: REALTIME_EVENTS.BOARD_MEMBER_REMOVED,
    onEvent: handleBoardMemberRemoved,
    enabled,
  });

  useRealtimeChannel({
    channelName,
    event: REALTIME_EVENTS.BOARD_MEMBER_ROLE_UPDATED,
    onEvent: handleBoardCardSync,
    enabled,
  });

  useRealtimeChannel({
    channelName,
    event: REALTIME_EVENTS.LIST_CREATED,
    onEvent: handleBoardCardSync,
    enabled,
  });

  useRealtimeChannel({
    channelName,
    event: REALTIME_EVENTS.LIST_UPDATED,
    onEvent: handleBoardCardSync,
    enabled,
  });

  useRealtimeChannel({
    channelName,
    event: REALTIME_EVENTS.LIST_DELETED,
    onEvent: handleBoardCardSync,
    enabled,
  });

  useRealtimeChannel({
    channelName,
    event: REALTIME_EVENTS.LIST_REORDERED,
    onEvent: handleBoardCardSync,
    enabled,
  });

  useRealtimeChannel({
    channelName,
    event: REALTIME_EVENTS.CARD_CREATED,
    onEvent: handleBoardCardSync,
    enabled,
  });

  useRealtimeChannel({
    channelName,
    event: REALTIME_EVENTS.CARD_DELETED,
    onEvent: handleCardDeleted,
    enabled,
  });

  const currentBoardMember = useMemo(() => {
    return boardMembers.find((member) => member.userId === currentUserId);
  }, [boardMembers, currentUserId]);

  const filtersAreActive = useMemo(() => {
    return (
      selectedMemberIds.length > 0 ||
      myWorkEnabled ||
      filters.noMembersEnabled ||
      filters.completedEnabled ||
      filters.notCompletedEnabled ||
      filters.selectedDueDateFilters.length > 0 ||
      (filters.selectedLabelIds && filters.selectedLabelIds.length > 0) ||
      !!filters.noLabelsEnabled
    );
  }, [selectedMemberIds, myWorkEnabled, filters]);

  const filteredData = useMemo(() => {
    if (!filtersAreActive) {
      return orderedData;
    }

    return orderedData.map((list) => ({
      ...list,
      cards: list.cards.filter((card) =>
        cardMatchesFilters(card, filters, currentBoardMember?.id),
      ),
    }));
  }, [filters, filtersAreActive, orderedData, currentBoardMember]);

  const visibleCardCount = useMemo(() => (
    filteredData.reduce((total, list) => total + list.cards.length, 0)
  ), [filteredData]);

  const onDragEnd = (result: DropResult) => {
    const { destination, source, type } = result;

    if (!destination) {
      return;
    }

    // if dropped in the same position
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    // User moves a list
    if (type === "list") {
      const items = reorder(
        orderedData,
        source.index,
        destination.index,
      ).map((item, index) => ({ ...item, order: index }));

      setOrderedData(items);
      executeUpdateListOrder({ items, boardId });
    }

    // User moves a card
    if (type === "card") {
      const newOrderedData = [...orderedData];
      const visibleData = filteredData;

      // Source and destination list
      const sourceList = newOrderedData.find(list => list.id === source.droppableId);
      const destList = newOrderedData.find(list => list.id === destination.droppableId);
      const visibleSourceList = visibleData.find(list => list.id === source.droppableId);
      const visibleDestList = visibleData.find(list => list.id === destination.droppableId);

      if (!sourceList || !destList || !visibleSourceList || !visibleDestList) {
        return;
      }

      // Check if cards exists on the sourceList
      if (!sourceList.cards) {
        sourceList.cards = [];
      }

      // Check if cards exists on the destList
      if (!destList.cards) {
        destList.cards = [];
      }

      // Moving the card in the same list
      if (source.droppableId === destination.droppableId) {
        if (filtersAreActive) {
          const visibleCard = visibleSourceList.cards[source.index];

          if (!visibleCard) {
            return;
          }

          const sourceIndex = sourceList.cards.findIndex(
            (card) => card.id === visibleCard.id,
          );
          const destinationIndex = getDestinationIndex({
            actualCards: sourceList.cards,
            visibleCards: visibleSourceList.cards,
            destinationIndex: destination.index,
          });

          if (sourceIndex === -1 || destinationIndex === -1) {
            return;
          }

          const reorderedCards = reorder(
            sourceList.cards,
            sourceIndex,
            destinationIndex > sourceIndex ? destinationIndex - 1 : destinationIndex,
          );

          reorderedCards.forEach((card, idx) => {
            card.order = idx;
          });

          sourceList.cards = reorderedCards;
          setOrderedData(newOrderedData);
          executeUpdateCardOrder({
            boardId,
            items: reorderedCards,
          });
          return;
        }

        const reorderedCards = reorder(
          sourceList.cards,
          source.index,
          destination.index,
        );

        reorderedCards.forEach((card, idx) => {
          card.order = idx;
        });

        sourceList.cards = reorderedCards;

        setOrderedData(newOrderedData);
        executeUpdateCardOrder({
          boardId: boardId,
          items: reorderedCards,
        });
        // User moves the card to another list
      } else {
        const visibleCard = visibleSourceList.cards[source.index];

        if (!visibleCard) {
          return;
        }

        const sourceIndex = filtersAreActive
          ? sourceList.cards.findIndex((card) => card.id === visibleCard.id)
          : source.index;
        const destinationIndex = filtersAreActive
          ? getDestinationIndex({
            actualCards: destList.cards,
            visibleCards: visibleDestList.cards,
            destinationIndex: destination.index,
          })
          : destination.index;

        if (sourceIndex === -1 || destinationIndex === -1) {
          return;
        }

        // Remove card from the source list
        const [movedCard] = sourceList.cards.splice(sourceIndex, 1);

        // Assign the new listId to the moved card
        movedCard.listId = destination.droppableId;

        // Add card to the destination list
        destList.cards.splice(destinationIndex, 0, movedCard);

        sourceList.cards.forEach((card, idx) => {
          card.order = idx;
        });

        // Update the order for each card in the destination list
        destList.cards.forEach((card, idx) => {
          card.order = idx;
        });

        setOrderedData(newOrderedData);
        executeUpdateCardOrder({
          boardId: boardId,
          items: destList.cards,
        });
      }
    }
  }

  return (
    <div className="h-full">
      {filtersAreActive && visibleCardCount === 0 && (
        <div className="mb-3 inline-flex rounded-lg bg-white/90 px-3 py-2 text-sm font-medium text-neutral-700 shadow-sm">
          Không có thẻ nào phù hợp với bộ lọc hiện tại.
        </div>
      )}
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="lists" type="list" direction="horizontal">
          {(provided) => (
            <ol
              {...provided.droppableProps}
              ref={provided.innerRef}
              className="flex h-full gap-x-3"
            >
              {filteredData.map((list, index) => {
                return (
                  <ListItem
                    key={list.id}
                    index={index}
                    data={list}
                  />
                )
              })}
              {provided.placeholder}
              <ListForm />
              <div className="flex-shrink-0 w-1" />
            </ol>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  );
};
