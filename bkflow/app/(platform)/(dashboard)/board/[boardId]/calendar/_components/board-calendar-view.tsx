"use client";

import {
  useEffect,
  useRef,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  format,
  startOfMonth,
} from "date-fns";
import { vi } from "date-fns/locale";

import { useCardModal } from "@/hooks/use-card-modal";
import { useBoardCalendarInvalidation } from "@/hooks/use-board-calendar-invalidation";
import { emptyBoardFilters, useBoardFilters } from "@/hooks/use-board-filters";
import {
  MONTH_VISIBLE_DESKTOP,
  MONTH_VISIBLE_MOBILE,
  WEEK_DAYS,
  WEEK_VISIBLE_DESKTOP,
  WEEK_VISIBLE_MOBILE,
} from "../_lib/constants";
import {
  formatDayTitle,
} from "../_lib/date-utils";
import { isOverdue } from "../_lib/item-utils";
import { BoardCalendarRealtimeSubscriptions } from "./board-calendar/realtime-subscriptions";
import { CreateCardDialog } from "./board-calendar/create-card-dialog";
import { UnscheduledPanel } from "./board-calendar/unscheduled-panel";
import type { BoardCalendarViewProps } from "../_types";
import { useCalendarQuery } from "../_hooks/use-calendar-query";
import { useCalendarCardActions } from "../_hooks/use-calendar-card-actions";
import { useCalendarCardInteractions } from "../_hooks/use-calendar-card-interactions";
import { useCalendarCreateCard } from "../_hooks/use-calendar-create-card";
import { useCalendarDayViewCreate } from "../_hooks/use-calendar-day-view-create";
import { useCalendarRealtime } from "../_hooks/use-calendar-realtime";
import { useCalendarState } from "../_hooks/use-calendar-state";
import { CalendarDayView } from "./calendar-day-view";
import { CalendarEmptyState } from "./calendar-empty-state";
import { CalendarErrorState } from "./calendar-error-state";
import { CalendarLoadingState } from "./calendar-loading-state";
import { CalendarMonthView } from "./calendar-month-view";
import { CalendarToolbar } from "./calendar-toolbar";
import { CalendarWeekView } from "./calendar-week-view";
import { ExpandedDayPanel } from "./expanded-day-panel";
import { useCalendarResize } from "../_hooks/use-calendar-resize";
import { useCalendarDnd } from "../_hooks/use-calendar-dnd";

export const BoardCalendarView = ({
  boardId,
  lists,
  currentUserId,
  currentBoardMemberId,
  initialNowIso,
  defaultUnscheduledCollapsed = false,
  variant = "default",
}: BoardCalendarViewProps) => {
  const router = useRouter();
  const cardModal = useCardModal();
  const queryClient = useQueryClient();
  const invalidateBoardCalendar = useBoardCalendarInvalidation(boardId);
  const {
    viewMode,
    anchorDate,
    currentTime,
    expandedDayKey,
    setExpandedDayKey,
    openDayOverflowGroupId,
    setOpenDayOverflowGroupId,
    createDialogDay,
    setCreateDialogDay,
    createTitle,
    setCreateTitle,
    createStartValue,
    setCreateStartValue,
    createDueValue,
    setCreateDueValue,
    createListId,
    setCreateListId,
    isUnscheduledCollapsed,
    setIsUnscheduledCollapsed,
    goToPrevious,
    goToNext,
    goToToday,
    changeViewMode,
  } = useCalendarState({ defaultUnscheduledCollapsed, initialNowIso, lists });
  const suppressClickRef = useRef(false);
  const filters = useBoardFilters((state) =>
    state.filtersByBoardId[boardId] ?? emptyBoardFilters,
  );
  const setSelectedLists = useBoardFilters((state) => state.setSelectedLists);
  const {
    fromIso,
    toIso,
    days,
    query,
    unscheduledCards,
    filtersAreActive,
    items,
    filteredUnscheduledCards,
    dayViewBlocks,
    dayViewBlocksById,
    desktopDayViewLayout,
    mobileDayViewLayout,
    weekRows,
    daysByKey,
    rangeSegmentsByWeek,
    rangeOccurrencesByDay,
    occurrencesById,
    occurrencesByDay,
  } = useCalendarQuery({
    boardId,
    viewMode,
    anchorDate,
    filters,
    currentBoardMemberId,
  });
  const {
    realtimeChannelName,
    realtimeEnabled,
    handleCalendarRealtime,
    handleCalendarRealtimeWithRefresh,
    handleBoardDeletedRealtime,
    handleAccessRevokedRealtime,
  } = useCalendarRealtime({
    boardId,
    currentUserId,
    router,
    cardModal,
    invalidateBoardCalendar,
  });
  useEffect(() => {
    let cancelled = false;

    queueMicrotask(() => {
      if (!cancelled) {
        setExpandedDayKey(null);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [filters, setExpandedDayKey]);
  useEffect(() => {
    let cancelled = false;

    queueMicrotask(() => {
      if (!cancelled) {
        setOpenDayOverflowGroupId(null);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [dayViewBlocks, setOpenDayOverflowGroupId]);
  const expandedDayItems = expandedDayKey
    ? [
      ...(rangeOccurrencesByDay[expandedDayKey] ?? []),
      ...(occurrencesByDay[expandedDayKey] ?? []),
    ]
    : [];

  const monthLabel = format(anchorDate, "'Tháng' M, yyyy", { locale: vi });
  const weekLabel = `Tuần ${format(new Date(fromIso), "dd/MM/yyyy", { locale: vi })} - ${format(new Date(toIso), "dd/MM/yyyy", { locale: vi })}`;
  const dayLabel = formatDayTitle(anchorDate);
  const rangeLabel = `${format(new Date(fromIso), "dd/MM/yyyy", { locale: vi })} - ${format(new Date(toIso), "dd/MM/yyyy", { locale: vi })}`;
  const titleLabel = viewMode === "month"
    ? monthLabel
    : viewMode === "week"
      ? weekLabel
      : dayLabel;
  const previousLabel = viewMode === "month"
    ? "Tháng trước"
    : viewMode === "week"
      ? "Tuần trước"
      : "Ngày trước";
  const nextLabel = viewMode === "month"
    ? "Tháng sau"
    : viewMode === "week"
      ? "Tuần sau"
      : "Ngày sau";
  const currentMonth = startOfMonth(anchorDate);
  const maxVisibleDesktop = viewMode === "month" ? MONTH_VISIBLE_DESKTOP : WEEK_VISIBLE_DESKTOP;
  const maxVisibleMobile = viewMode === "month" ? MONTH_VISIBLE_MOBILE : WEEK_VISIBLE_MOBILE;
  const selectedCreateDayLabel = createDialogDay
    ? format(createDialogDay, "EEEE, dd/MM/yyyy", { locale: vi })
    : "";
  const scheduledItemsCount = items.length;
  const completedItemsCount = items.filter((item) => item.isCompleted).length;
  const overdueItemsCount = items.filter(isOverdue).length;

  const {
    executeUpdateCard,
    executeSetChecklistItemDueDate,
    isUpdatingCardDate,
    isUpdatingChecklistItemDueDate,
    setUpdateSuccessToast,
    setUpdatingChecklistItemCardId,
  } = useCalendarCardActions({
    query,
    queryClient,
    router,
    invalidateBoardCalendar,
    setExpandedDayKey,
    onUpdateComplete: () => {
      resetCalendarDragState();
      resetRangeResize();
      resetDayViewBlockResize();
    },
    onChecklistComplete: () => {
      handleOccurrenceDragEnd();
    },
  });
  const {
    resizingRange,
    resizingDayViewBlock,
    resetRangeResize,
    resetDayViewBlockResize,
    handleDayViewBlockResizeStart,
    handleDayViewBlockResizeMove,
    handleDayViewBlockResizeEnd,
    handleRangeResizeStart,
    handleRangeResizeMove,
    handleRangeResizeEnd,
  } = useCalendarResize({
    boardId,
    anchorDate,
    daysByKey,
    executeUpdateCard,
    setUpdateSuccessToast,
    isUpdatingCardDate,
    isUpdatingChecklistItemDueDate,
    invalidateBoardCalendar,
    refetchCalendar: () => {
      void query.refetch();
    },
    suppressClickRef,
    setExpandedDayKey,
    setDayViewCreateSelection: (selection) => setDayViewCreateSelection(selection),
    setDragOverDayKey: (dayKey) => setDragOverDayKey(dayKey),
    setDragOverDaySlotIndex: (slotIndex) => setDragOverDaySlotIndex(slotIndex),
    setDragOverDayMinute: (minute) => setDragOverDayMinute(minute),
  });
  const {
    draggingOccurrenceId,
    draggingUnscheduledCardId,
    draggingBoardCardId,
    draggingDayViewBlockId,
    dragOverDayKey,
    setDragOverDayKey,
    dragOverDaySlotIndex,
    setDragOverDaySlotIndex,
    dragOverDayMinute,
    setDragOverDayMinute,
    resetCalendarDragState,
    handleOccurrenceDragStart,
    handleOccurrenceDragEnd,
    handleUnscheduledCardDragStart,
    handleUnscheduledCardDragEnd,
    handleDayViewBlockDragStart,
    handleDayViewBlockDragEnd,
    handleDayDragOver,
    handleDayDrop,
    handleDayViewDragOver,
    handleDayViewDragLeave,
    handleDayViewDrop,
  } = useCalendarDnd({
    boardId,
    anchorDate,
    occurrencesById,
    dayViewBlocksById,
    executeUpdateCard,
    executeSetChecklistItemDueDate,
    isUpdatingCardDate,
    isUpdatingChecklistItemDueDate,
    invalidateBoardCalendar,
    suppressClickRef,
    setExpandedDayKey,
    setUpdateSuccessToast,
    setUpdatingChecklistItemCardId,
    resetDayViewBlockResize,
    resetDayViewCreateSelection: () => resetDayViewCreateSelection(),
  });
  const canOpenCreateDialog = !(
    draggingOccurrenceId ||
    draggingUnscheduledCardId ||
    draggingBoardCardId ||
    draggingDayViewBlockId ||
    resizingRange ||
    resizingDayViewBlock ||
    isUpdatingCardDate ||
    isUpdatingChecklistItemDueDate ||
    lists.length === 0
  );
  const {
    createFieldErrors,
    isCreatingCard,
    openCreateDialogWithRange,
    openCreateDialog,
    closeCreateDialog,
    submitCreateCard,
  } = useCalendarCreateCard({
    boardId,
    lists,
    query,
    queryClient,
    router,
    cardModal,
    invalidateBoardCalendar,
    canOpenCreateDialog,
    setExpandedDayKey,
    setCreateDialogDay,
    createTitle,
    setCreateTitle,
    createStartValue,
    setCreateStartValue,
    createDueValue,
    setCreateDueValue,
    createListId,
    setCreateListId,
    resetDayViewCreateSelection: () => resetDayViewCreateSelection(),
    suppressClickRef,
  });
  const {
    setDayViewCreateSelection,
    dayViewCreatePreview,
    resetDayViewCreateSelection,
    handleDayViewCreatePointerDown,
    handleDayViewCreatePointerMove,
    handleDayViewCreatePointerEnd,
  } = useCalendarDayViewCreate({
    anchorDate,
    isInteractionBlocked: !!(
      draggingOccurrenceId ||
      draggingUnscheduledCardId ||
      draggingBoardCardId ||
      draggingDayViewBlockId ||
      resizingRange ||
      resizingDayViewBlock ||
      isUpdatingCardDate ||
      isUpdatingChecklistItemDueDate ||
      isCreatingCard
    ),
    canCreate: lists.length > 0,
    suppressClickRef,
    setExpandedDayKey,
    setOpenDayOverflowGroupId,
    openCreateDialogWithRange,
  });
  const {
    openCalendarCard,
    openCalendarCardDirect,
    canClearStartDate,
    canClearDueDate,
    toggleCalendarCardComplete,
    clearCalendarStartDate,
    clearCalendarDueDate,
    handleQuickActionClick,
    handleUnscheduledCardClick,
  } = useCalendarCardInteractions({
    boardId,
    cardModal,
    suppressClickRef,
    setExpandedDayKey,
    executeUpdateCard,
    setUpdateSuccessToast,
  });
  const renderCalendarDayTimeGrid = (isSkeleton = false) => (
    <CalendarDayView
      dayViewProps={{
        anchorDate,
        currentTime,
        isSkeleton,
        dayViewBlocks,
        desktopDayViewLayout,
        mobileDayViewLayout,
        dayViewCreatePreview,
        openDayOverflowGroupId,
        resizingDayViewBlock,
        dragOverDaySlotIndex,
        dragOverDayMinute,
        draggingDayViewBlockId,
        isUpdatingCardDate,
        isUpdatingChecklistItemDueDate,
        onOpenDayOverflowGroupChange: setOpenDayOverflowGroupId,
        onOpenCard: openCalendarCard,
        onDayViewBlockDragStart: handleDayViewBlockDragStart,
        onDayViewBlockDragEnd: handleDayViewBlockDragEnd,
        onDayViewBlockResizeStart: handleDayViewBlockResizeStart,
        onDayViewBlockResizeMove: handleDayViewBlockResizeMove,
        onDayViewBlockResizeEnd: handleDayViewBlockResizeEnd,
        onDayViewBlockResizeCancel: resetDayViewBlockResize,
        onDayViewCreatePointerDown: handleDayViewCreatePointerDown,
        onDayViewCreatePointerMove: handleDayViewCreatePointerMove,
        onDayViewCreatePointerEnd: handleDayViewCreatePointerEnd,
        onDayViewCreatePointerCancel: resetDayViewCreateSelection,
        onDayViewDragOver: handleDayViewDragOver,
        onDayViewDragLeave: handleDayViewDragLeave,
        onDayViewDrop: handleDayViewDrop,
      }}
    />
  );

  const calendarWeekRowProps = {
    viewMode,
    variant,
    currentMonth,
    maxVisibleDesktop,
    maxVisibleMobile,
    listsCount: lists.length,
    isCreatingCard,
    isUpdatingCardDate,
    isUpdatingChecklistItemDueDate,
    draggingOccurrenceId,
    draggingUnscheduledCardId,
    draggingBoardCardId,
    draggingDayViewBlockId,
    dragOverDayKey,
    resizingRange,
    occurrencesByDay,
    rangeOccurrencesByDay,
    rangeSegmentsByWeek,
    canClearStartDate,
    canClearDueDate,
    onOpenCard: openCalendarCard,
    onOpenCardDirect: openCalendarCardDirect,
    onOccurrenceDragStart: handleOccurrenceDragStart,
    onOccurrenceDragEnd: handleOccurrenceDragEnd,
    onQuickActionClick: handleQuickActionClick,
    onToggleComplete: toggleCalendarCardComplete,
    onClearStartDate: clearCalendarStartDate,
    onClearDueDate: clearCalendarDueDate,
    onOpenCreateDialog: openCreateDialog,
    onSetExpandedDayKey: setExpandedDayKey,
    onDayDragOver: handleDayDragOver,
    onDayDrop: handleDayDrop,
    onDayDragLeave: (dayKey: string) =>
      setDragOverDayKey((value) => value === dayKey ? null : value),
    onRangeResizeStart: handleRangeResizeStart,
    onRangeResizeMove: handleRangeResizeMove,
    onRangeResizeEnd: handleRangeResizeEnd,
    onRangeResizeCancel: resetRangeResize,
  };



  return (
    <>
    <BoardCalendarRealtimeSubscriptions
      channelName={realtimeChannelName}
      enabled={realtimeEnabled}
      onInvalidate={handleCalendarRealtime}
      onRefresh={handleCalendarRealtimeWithRefresh}
      onBoardDeleted={handleBoardDeletedRealtime}
      onAccessRevoked={handleAccessRevokedRealtime}
    />
    <div className="flex h-full min-h-0 flex-col gap-3 lg:flex-row">
    <section className="flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-white/20 bg-white/95 shadow-xl backdrop-blur">
      <CalendarToolbar
        titleLabel={titleLabel}
        rangeLabel={rangeLabel}
        scheduledItemsCount={scheduledItemsCount}
        completedItemsCount={completedItemsCount}
        overdueItemsCount={overdueItemsCount}
        isUnscheduledCollapsed={isUnscheduledCollapsed}
        filteredUnscheduledCount={filteredUnscheduledCards.length}
        viewMode={viewMode}
        previousLabel={previousLabel}
        nextLabel={nextLabel}
        onToggleUnscheduledCollapsed={() => setIsUnscheduledCollapsed((value) => !value)}
        onChangeViewMode={changeViewMode}
        onPrevious={goToPrevious}
        onToday={goToToday}
        onNext={goToNext}
      />
      <div className="min-h-0 flex-1 overflow-y-auto p-3 md:p-4">
        {viewMode === "month" && (
          <div className="grid grid-cols-7 rounded-t-lg border border-b-0 border-neutral-200 bg-neutral-50">
            {WEEK_DAYS.map((day) => (
              <div
                key={day}
                className="border-r border-neutral-200 px-1.5 py-2 text-center text-[11px] font-semibold uppercase text-neutral-500 last:border-r-0"
              >
                {day}
              </div>
            ))}
          </div>
        )}

        {query.isLoading && viewMode === "day" && renderCalendarDayTimeGrid(true)}

        {query.isLoading && viewMode !== "day" && (
          <CalendarLoadingState
            viewMode={viewMode}
            days={days}
          />
        )}

        {query.isError && <CalendarErrorState />}

        {query.isSuccess && (
          <>
            {viewMode === "month" ? (
              <CalendarMonthView
                weekRows={weekRows}
                rowProps={calendarWeekRowProps}
              />
            ) : viewMode === "week" ? (
              <CalendarWeekView
                days={days}
                weekRows={weekRows}
                rowProps={calendarWeekRowProps}
              />
            ) : (
              renderCalendarDayTimeGrid()
            )}
            {items.length === 0 && (
              <CalendarEmptyState
                viewMode={viewMode}
                filtersAreActive={filtersAreActive}
              />
            )}

            {expandedDayKey && expandedDayItems.length > 0 && (
              <ExpandedDayPanel
                dayKey={expandedDayKey}
                occurrences={expandedDayItems}
                isUpdatingCardDate={isUpdatingCardDate}
                canClearStartDate={canClearStartDate}
                canClearDueDate={canClearDueDate}
                onOpenCard={openCalendarCard}
                onOpenCardDirect={openCalendarCardDirect}
                onQuickActionClick={handleQuickActionClick}
                onToggleComplete={toggleCalendarCardComplete}
                onClearStartDate={clearCalendarStartDate}
                onClearDueDate={clearCalendarDueDate}
                onClose={() => setExpandedDayKey(null)}
              />
            )}
          </>
        )}
      </div>
    </section>
    <UnscheduledPanel
      lists={lists}
      variant={variant}
      isCollapsed={isUnscheduledCollapsed}
      setIsCollapsed={setIsUnscheduledCollapsed}
      filtersAreActive={filtersAreActive}
      selectedListIds={filters.selectedListIds}
      unscheduledCards={unscheduledCards}
      filteredUnscheduledCards={filteredUnscheduledCards}
      isLoading={query.isLoading}
      isError={query.isError}
      isSuccess={query.isSuccess}
      isUpdatingCardDate={isUpdatingCardDate}
      isUpdatingChecklistItemDueDate={isUpdatingChecklistItemDueDate}
      draggingUnscheduledCardId={draggingUnscheduledCardId}
      onSelectedListIdsChange={(listIds) => setSelectedLists(boardId, listIds)}
      onCardClick={(card) => handleUnscheduledCardClick(card.cardId)}
      onCardDragStart={handleUnscheduledCardDragStart}
      onCardDragEnd={handleUnscheduledCardDragEnd}
    />
    </div>
    <CreateCardDialog
      open={!!createDialogDay}
      selectedDayLabel={selectedCreateDayLabel}
      title={createTitle}
      startValue={createStartValue}
      dueValue={createDueValue}
      listId={createListId}
      lists={lists}
      fieldErrors={createFieldErrors}
      isLoading={isCreatingCard}
      onOpenChange={closeCreateDialog}
      onTitleChange={setCreateTitle}
      onStartValueChange={setCreateStartValue}
      onDueValueChange={setCreateDueValue}
      onListIdChange={setCreateListId}
      onSubmit={submitCreateCard}
    />
    </>
  );
};
