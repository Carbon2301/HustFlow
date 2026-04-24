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

import { getDefaultCalendarDueDate, type CalendarDropTarget } from "../_lib/calendar-drop-bridge";
import { getDestinationIndex, reorder } from "../_lib/dnd-utils";

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
  rollbackRef?: React.MutableRefObject<(() => void) | null>;
};

const applyListOrder = (lists: ListWithCards[]) =>
  lists.map((list, index) => (
    list.order === index ? list : { ...list, order: index }
  ));

const applyCardOrder = (
  cards: CardWithAssignees[],
  listId?: string,
) =>
  cards.map((card, index) => {
    const nextListId = listId ?? card.listId;

    if (card.order === index && card.listId === nextListId) {
      return card;
    }

    return {
      ...card,
      order: index,
      listId: nextListId,
    };
  });

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
  rollbackRef,
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

    const captureRollback = () => {
      if (rollbackRef) {
        const snapshot = orderedData.map((list) => ({
          ...list,
          cards: [...list.cards],
        }));
        rollbackRef.current = () => {
          setOrderedData(snapshot);
        };
      }
    };

    // User moves a list
    if (type === "list") {
      const items = applyListOrder(reorder(
        orderedData,
        source.index,
        destination.index,
      ));

      captureRollback();
      setOrderedData(items);
      executeUpdateListOrder({ items, boardId });
      return;
    }

    // User moves a card
    if (type === "card") {
      const visibleData = filteredData;

      // Source and destination list
      const sourceList = orderedData.find(list => list.id === source.droppableId);
      const destList = orderedData.find(list => list.id === destination.droppableId);
      const visibleSourceList = visibleData.find(list => list.id === source.droppableId);
      const visibleDestList = visibleData.find(list => list.id === destination.droppableId);

      if (!sourceList || !destList || !visibleSourceList || !visibleDestList) {
        return;
      }

      // Moving the card in the same list
      if (source.droppableId === destination.droppableId) {
        let reorderedCards: CardWithAssignees[];

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

          reorderedCards = reorder(
            sourceList.cards,
            sourceIndex,
            destinationIndex > sourceIndex ? destinationIndex - 1 : destinationIndex,
          );
        } else {
          reorderedCards = reorder(
            sourceList.cards,
            source.index,
            destination.index,
          );
        }

        const orderedCards = applyCardOrder(reorderedCards);
        const nextOrderedData = orderedData.map((list) =>
          list.id === sourceList.id
            ? {
                ...list,
                cards: orderedCards,
              }
            : list,
        );

        captureRollback();
        setOrderedData(nextOrderedData);
        executeUpdateCardOrder({
          boardId: boardId,
          items: orderedCards,
        });
        return;
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

        const movedCard = sourceList.cards[sourceIndex];
        const sourceCards = sourceList.cards.filter((card) => card.id !== movedCard.id);
        const destinationCards = [...destList.cards];
        destinationCards.splice(destinationIndex, 0, {
          ...movedCard,
          listId: destination.droppableId,
        });

        const orderedSourceCards = applyCardOrder(sourceCards);
        const orderedDestinationCards = applyCardOrder(
          destinationCards,
          destination.droppableId,
        );
        const nextOrderedData = orderedData.map((list) => {
          if (list.id === sourceList.id) {
            return {
              ...list,
              cards: orderedSourceCards,
            };
          }

          if (list.id === destList.id) {
            return {
              ...list,
              cards: orderedDestinationCards,
            };
          }

          return list;
        });

        captureRollback();
        setOrderedData(nextOrderedData);
        executeUpdateCardOrder({
          boardId: boardId,
          items: [...orderedSourceCards, ...orderedDestinationCards],
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
