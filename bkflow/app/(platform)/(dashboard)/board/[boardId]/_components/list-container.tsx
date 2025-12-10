"use client";

import { toast } from "sonner";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { DragDropContext, Droppable, type DragStart, type DropResult } from "@hello-pangea/dnd";
import { BoardMember, BoardMemberRole } from "@prisma/client";

import { CardWithAssignees, ListWithCards } from "@/types";
import { useAction } from "@/hooks/use-action";
import { emptyBoardFilters, useBoardFilters, BoardFilterState } from "@/hooks/use-board-filters";
import { updateListOrder } from "@/actions/update-list-order";
import { updateCardOrder } from "@/actions/update-card-order";
import { updateCard } from "@/actions/update-card";
import { useRealtimeChannel } from "@/hooks/use-realtime-channel";
import { useCardModal } from "@/hooks/use-card-modal";
import { useBoardCalendarInvalidation } from "@/hooks/use-board-calendar-invalidation";
import {
  getDateTimezoneOffset,
  getEndOfTomorrow,
  getStartOfTomorrow,
  isOverdue,
} from "@/lib/date-utils";
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
  ChecklistItemMovedPayload,
  ChecklistItemReorderedPayload,
  ChecklistItemPayload,
  ChecklistPayload,
  CardLabelPayload,
  AttachmentReorderedPayload,
  LabelPayload,
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
  enableCalendarDragHandle?: boolean;
};

function reorder<T>(list: T[], startIndex: number, endIndex: number) {
  const result = Array.from(list);
  const [removed] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, removed);

  return result;
};

const getDefaultCalendarDueDate = (day: Date) =>
  new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    9,
    0,
    0,
    0,
  );

const CALENDAR_DAY_DRAG_CLASSES = [
  "bg-violet-50",
  "ring-2",
  "ring-inset",
  "ring-violet-400",
];

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
        const isPast = isOverdue(dueDate, now);

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
          const startOfTomorrow = getStartOfTomorrow(now);
          const endOfTomorrow = getEndOfTomorrow(now);

          if (dueDate.getTime() >= startOfTomorrow.getTime() && dueDate.getTime() <= endOfTomorrow.getTime()) {
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
  enableCalendarDragHandle = false,
}: ListContainerProps) => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const cardModal = useCardModal();
  const invalidateBoardCalendar = useBoardCalendarInvalidation(boardId);
  const [orderedData, setOrderedData] = useState(data);
  const processedCardEventIdsRef = useRef<Set<string>>(new Set());
  const lastDragPointRef = useRef<{ x: number; y: number } | null>(null);
  const activeCalendarDragCardIdRef = useRef<string | null>(null);
  const highlightedCalendarDayRef = useRef<HTMLElement | null>(null);
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

  const { execute: executeScheduleCardDate } = useAction(updateCard, {
    onSuccess: (data) => {
      toast.success("Đã lên lịch thẻ");
      invalidateBoardCalendar();
      queryClient.invalidateQueries({ queryKey: ["card", data.id] });
      queryClient.invalidateQueries({ queryKey: ["card-logs", data.id] });
      router.refresh();
    },
    onError: (error) => {
      toast.error(error);
      invalidateBoardCalendar();
    },
  });

  useEffect(() => {
    setOrderedData(data);
  }, [data]);

  useEffect(() => {
    if (!enableCalendarDragHandle) {
      return;
    }

    const clearHighlightedCalendarDay = () => {
      highlightedCalendarDayRef.current?.classList.remove(
        ...CALENDAR_DAY_DRAG_CLASSES,
      );
      highlightedCalendarDayRef.current = null;
    };

    const updateHighlightedCalendarDay = (x: number, y: number) => {
      if (!activeCalendarDragCardIdRef.current) {
        clearHighlightedCalendarDay();
        return;
      }

      const dayElement = document
        .elementsFromPoint(x, y)
        .map((element) => element.closest<HTMLElement>("[data-calendar-day-key]"))
        .find(Boolean) ?? null;

      if (highlightedCalendarDayRef.current === dayElement) {
        return;
      }

      clearHighlightedCalendarDay();

      if (dayElement) {
        dayElement.classList.add(...CALENDAR_DAY_DRAG_CLASSES);
        highlightedCalendarDayRef.current = dayElement;
      }
    };

    const updateLastDragPoint = (event: MouseEvent | PointerEvent) => {
      lastDragPointRef.current = {
        x: event.clientX,
        y: event.clientY,
      };
      updateHighlightedCalendarDay(event.clientX, event.clientY);
    };

    window.addEventListener("pointermove", updateLastDragPoint, true);
    window.addEventListener("mousemove", updateLastDragPoint, true);

    return () => {
      window.removeEventListener("pointermove", updateLastDragPoint, true);
      window.removeEventListener("mousemove", updateLastDragPoint, true);
      clearHighlightedCalendarDay();
    };
  }, [enableCalendarDragHandle]);

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

  useRealtimeChannel({
    channelName,
    event: REALTIME_EVENTS.CHECKLIST_CREATED,
    onEvent: handleChecklistSync,
    enabled,
  });

  useRealtimeChannel({
    channelName,
    event: REALTIME_EVENTS.CHECKLIST_UPDATED,
    onEvent: handleChecklistSync,
    enabled,
  });

  useRealtimeChannel({
    channelName,
    event: REALTIME_EVENTS.CHECKLIST_DELETED,
    onEvent: handleChecklistSync,
    enabled,
  });

  useRealtimeChannel({
    channelName,
    event: REALTIME_EVENTS.CHECKLIST_ITEM_CREATED,
    onEvent: handleChecklistSync,
    enabled,
  });

  useRealtimeChannel({
    channelName,
    event: REALTIME_EVENTS.CHECKLIST_ITEM_UPDATED,
    onEvent: handleChecklistSync,
    enabled,
  });

  useRealtimeChannel({
    channelName,
    event: REALTIME_EVENTS.CHECKLIST_ITEM_DELETED,
    onEvent: handleChecklistSync,
    enabled,
  });

  useRealtimeChannel({
    channelName,
    event: REALTIME_EVENTS.CHECKLIST_ITEM_TOGGLED,
    onEvent: handleChecklistSync,
    enabled,
  });

  useRealtimeChannel({
    channelName,
    event: REALTIME_EVENTS.CHECKLIST_ITEM_ASSIGNEE_UPDATED,
    onEvent: handleChecklistSync,
    enabled,
  });

  useRealtimeChannel({
    channelName,
    event: REALTIME_EVENTS.CHECKLIST_ITEM_DUE_DATE_UPDATED,
    onEvent: handleChecklistSync,
    enabled,
  });

  useRealtimeChannel({
    channelName,
    event: REALTIME_EVENTS.CHECKLIST_ITEM_REORDERED,
    onEvent: handleChecklistSync,
    enabled,
  });

  useRealtimeChannel({
    channelName,
    event: REALTIME_EVENTS.CHECKLIST_ITEM_MOVED,
    onEvent: handleChecklistSync,
    enabled,
  });

  useRealtimeChannel({
    channelName,
    event: REALTIME_EVENTS.LABEL_CREATED,
    onEvent: handleLabelSync,
    enabled,
  });

  useRealtimeChannel({
    channelName,
    event: REALTIME_EVENTS.LABEL_UPDATED,
    onEvent: handleLabelSync,
    enabled,
  });

  useRealtimeChannel({
    channelName,
    event: REALTIME_EVENTS.LABEL_DELETED,
    onEvent: handleLabelSync,
    enabled,
  });

  useRealtimeChannel({
    channelName,
    event: REALTIME_EVENTS.CARD_LABEL_ATTACHED,
    onEvent: handleLabelSync,
    enabled,
  });

  useRealtimeChannel({
    channelName,
    event: REALTIME_EVENTS.CARD_LABEL_DETACHED,
    onEvent: handleLabelSync,
    enabled,
  });

  useRealtimeChannel({
    channelName,
    event: REALTIME_EVENTS.ATTACHMENT_REORDERED,
    onEvent: handleAttachmentReordered,
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

  const getCalendarDayUnderLastDragPoint = useCallback(() => {
    const point = lastDragPointRef.current;

    if (!point) {
      return null;
    }

    const elements = document.elementsFromPoint(point.x, point.y);
    const dayElement = elements
      .map((element) => element.closest<HTMLElement>("[data-calendar-day-key]"))
      .find(Boolean);
    const dayKey = dayElement?.dataset.calendarDayKey;

    if (!dayKey) {
      return null;
    }

    const [year, month, day] = dayKey.split("-").map(Number);

    if (!year || !month || !day) {
      return null;
    }

    return new Date(year, month - 1, day);
  }, []);

  const scheduleDraggedCardOnCalendar = useCallback((cardId: string) => {
    if (!enableCalendarDragHandle) {
      return false;
    }

    const targetDay = getCalendarDayUnderLastDragPoint();

    if (!targetDay) {
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

    const dueDate = getDefaultCalendarDueDate(targetDay);

    executeScheduleCardDate({
      id: card.id,
      boardId,
      dueDate,
      dueDateTimezoneOffset: getDateTimezoneOffset(dueDate),
      isCompleted: card.isCompleted,
    });

    return true;
  }, [
    boardId,
    enableCalendarDragHandle,
    executeScheduleCardDate,
    getCalendarDayUnderLastDragPoint,
    invalidateBoardCalendar,
    orderedData,
  ]);

  const clearCalendarDropHighlight = useCallback(() => {
    highlightedCalendarDayRef.current?.classList.remove(
      ...CALENDAR_DAY_DRAG_CLASSES,
    );
    highlightedCalendarDayRef.current = null;
    activeCalendarDragCardIdRef.current = null;
  }, []);

  const onDragStart = (start: DragStart) => {
    if (enableCalendarDragHandle && start.type === "card") {
      activeCalendarDragCardIdRef.current = start.draggableId;
    }
  };

  const onDragEnd = (result: DropResult) => {
    const { destination, source, type } = result;

    if (!destination) {
      if (type === "card" && scheduleDraggedCardOnCalendar(result.draggableId)) {
        clearCalendarDropHighlight();
        return;
      }

      clearCalendarDropHighlight();
      return;
    }

    clearCalendarDropHighlight();

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
      <DragDropContext onDragStart={onDragStart} onDragEnd={onDragEnd}>
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
