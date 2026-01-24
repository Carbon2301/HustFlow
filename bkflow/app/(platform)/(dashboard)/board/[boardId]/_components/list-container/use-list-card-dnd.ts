"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { DragStart, DropResult } from "@hello-pangea/dnd";
import type { BoardMember } from "@prisma/client";

import { getDateTimezoneOffset } from "@/lib/date-utils";
import {
  boardFiltersAreActive,
  cardMatchesBoardFilters,
} from "@/lib/board-filters";
import type { BoardFilterState } from "@/hooks/use-board-filters";
import type { CardWithAssignees, ListWithCards } from "@/types";

import { getDefaultCalendarDueDate, type CalendarDropTarget } from "./calendar-drop-bridge";
import { getDestinationIndex, reorder } from "./dnd-utils";

type CalendarBridgeApi = {
  beginCalendarDrag: (cardId: string) => void;
  getCalendarDropDateUnderLastDragPoint: () => CalendarDropTarget | null;
  clearCalendarDropHighlight: () => void;
};

type ScheduleCardDateInput = {
  id: string;
  boardId: string;
  startDate?: Date;
  dueDate: Date;
  dueDateTimezoneOffset: number;
  isCompleted: boolean;
};

type UseListCardDndOptions = {
  data: ListWithCards[];
  boardId: string;
  boardMembers: BoardMember[];
  currentUserId: string;
  filters: BoardFilterState;
  enableCalendarDragHandle: boolean;
  executeUpdateListOrder: (input: { items: ListWithCards[]; boardId: string }) => void;
  executeUpdateCardOrder: (input: { boardId: string; items: CardWithAssignees[] }) => void;
  executeScheduleCardDate: (input: ScheduleCardDateInput) => void;
  invalidateBoardCalendar: () => void;
  calendarBridge: CalendarBridgeApi;
};

export const useListCardDnd = ({
  data,
  boardId,
  boardMembers,
  currentUserId,
  filters,
  enableCalendarDragHandle,
  executeUpdateListOrder,
  executeUpdateCardOrder,
  executeScheduleCardDate,
  invalidateBoardCalendar,
  calendarBridge,
}: UseListCardDndOptions) => {
  const [orderedData, setOrderedData] = useState(data);

  useEffect(() => {
    setOrderedData(data);
  }, [data]);

  const currentBoardMember = useMemo(() => {
    return boardMembers.find((member) => member.userId === currentUserId);
  }, [boardMembers, currentUserId]);

  const filtersAreActive = useMemo(() => {
    return boardFiltersAreActive(filters);
  }, [filters]);

  const filteredData = useMemo(() => {
    if (!filtersAreActive) {
      return orderedData;
    }

    return orderedData.map((list) => ({
      ...list,
      cards: list.cards.filter((card) =>
        cardMatchesBoardFilters(card, filters, currentBoardMember?.id),
      ),
    }));
  }, [filters, filtersAreActive, orderedData, currentBoardMember]);

  const visibleCardCount = useMemo(() => (
    filteredData.reduce((total, list) => total + list.cards.length, 0)
  ), [filteredData]);

  const scheduleDraggedCardOnCalendar = useCallback((cardId: string) => {
    if (!enableCalendarDragHandle) {
      return false;
    }

    const targetDrop = calendarBridge.getCalendarDropDateUnderLastDragPoint();

    if (!targetDrop) {
      return false;
    }

    const card = orderedData
      .flatMap((list) => list.cards)
      .find((item) => item.id === cardId);

    if (!card) {
      toast.error("Không thể xác định thẻ đang kéo.");
      invalidateBoardCalendar();
      return true;
    }

    const startDate = targetDrop.isDayViewSlot ? targetDrop.date : undefined;
    const dueDate = startDate
      ? new Date(startDate.getTime() + 60 * 60 * 1000)
      : getDefaultCalendarDueDate(targetDrop.date);

    executeScheduleCardDate({
      id: card.id,
      boardId,
      ...(startDate ? { startDate } : {}),
      dueDate,
      dueDateTimezoneOffset: startDate ? -7 * 60 : getDateTimezoneOffset(dueDate),
      isCompleted: card.isCompleted,
    });

    return true;
  }, [
    boardId,
    enableCalendarDragHandle,
    executeScheduleCardDate,
    calendarBridge,
    invalidateBoardCalendar,
    orderedData,
  ]);

  const onDragStart = (start: DragStart) => {
    if (enableCalendarDragHandle && start.type === "card") {
      calendarBridge.beginCalendarDrag(start.draggableId);
    }
  };

  const onDragEnd = (result: DropResult) => {
    const { destination, source, type } = result;

    if (!destination) {
      if (type === "card" && scheduleDraggedCardOnCalendar(result.draggableId)) {
        calendarBridge.clearCalendarDropHighlight();
        return;
      }

      calendarBridge.clearCalendarDropHighlight();
      return;
    }

    calendarBridge.clearCalendarDropHighlight();

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

  return {
    orderedData,
    setOrderedData,
    filteredData,
    filtersAreActive,
    visibleCardCount,
    onDragStart,
    onDragEnd,
  };
};
