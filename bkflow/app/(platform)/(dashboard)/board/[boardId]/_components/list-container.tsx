"use client";

import { useCallback, useRef } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { DragDropContext, Droppable } from "@hello-pangea/dnd";
import { BoardMember, BoardMemberRole } from "@prisma/client";

import { ListWithCards } from "@/types";
import { useAction } from "@/hooks/use-action";
import { emptyBoardFilters, useBoardFilters } from "@/hooks/use-board-filters";
import { updateListOrder } from "@/actions/update-list-order";
import { updateCardOrder } from "@/actions/update-card-order";
import { updateCard } from "@/actions/update-card";
import { useCardModal } from "@/hooks/use-card-modal";
import { useBoardCalendarInvalidation } from "@/hooks/use-board-calendar-invalidation";
import { realtimeChannels } from "@/lib/realtime/channels";
import { isRealtimeClientConfigured } from "@/lib/realtime/client";
import { debugBoardRealtime } from "@/lib/realtime/debug";

import { ListForm } from "./list-form";
import { ListItem } from "./list-item";
import { BoardStateProvider } from "./list-container/board-state-context";
import { BoardRealtimeSubscriptions } from "./list-container/board-realtime-subscriptions";
import { useBoardRealtimeSync } from "./list-container/use-board-realtime-sync";
import { useCalendarDropBridge } from "./list-container/use-calendar-drop-bridge";
import { useListCardDnd } from "./list-container/use-list-card-dnd";

interface ListContainerProps {
  data: ListWithCards[];
  boardId: string;
  boardMembers: BoardMember[];
  currentUserId: string;
  currentMemberRole: BoardMemberRole;
  enableCalendarDragHandle?: boolean;
};

export const ListContainer = ({
  data,
  boardId,
  boardMembers,
  currentUserId,
  currentMemberRole,
  enableCalendarDragHandle = false,
}: ListContainerProps) => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const cardModal = useCardModal();
  const invalidateBoardCalendar = useBoardCalendarInvalidation(boardId);
  const filters = useBoardFilters((state) =>
    state.filtersByBoardId[boardId] ?? emptyBoardFilters,
  );
  const canEdit = currentMemberRole !== BoardMemberRole.VIEWER;

  const rollbackRef = useRef<(() => void) | null>(null);
  const subscriptionCatchUpDoneRef = useRef(false);

  const { execute: executeUpdateListOrder } = useAction(updateListOrder, {
    onSuccess: () => {
      rollbackRef.current = null;
    },
    onError: (error) => {
      toast.error(error);
      rollbackRef.current?.();
      rollbackRef.current = null;
    },
  });

  const { execute: executeUpdateCardOrder } = useAction(updateCardOrder, {
    onSuccess: () => {
      rollbackRef.current = null;
    },
    onError: (error) => {
      toast.error(error);
      rollbackRef.current?.();
      rollbackRef.current = null;
    },
  });

  const { execute: executeScheduleCardDate } = useAction(updateCard, {
    onSuccess: (data) => {
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

  const calendarBridge = useCalendarDropBridge({
    enableCalendarDragHandle,
  });

  const {
    orderedData,
    setOrderedData,
    filteredData,
    filtersAreActive,
    visibleCardCount,
    onDragStart,
    onDragEnd,
  } = useListCardDnd({
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
  });

  const realtimeCallbacks = useBoardRealtimeSync({
    boardId,
    currentUserId,
    cardModal,
    router,
    queryClient,
    setOrderedData,
  });
  const channelName = realtimeChannels.board(boardId);
  const enabled = isRealtimeClientConfigured();
  const handleBoardRealtimeSubscribed = useCallback(() => {
    if (subscriptionCatchUpDoneRef.current) {
      return;
    }

    subscriptionCatchUpDoneRef.current = true;
    debugBoardRealtime("fallback fetch/refresh", {
      boardId,
      reason: "initial subscription catch-up",
    });
    router.refresh();
  }, [boardId, router]);

  return (
    <BoardStateProvider boardId={boardId} data={orderedData} setData={setOrderedData}>
      <div className="h-full">
      <BoardRealtimeSubscriptions
        channelName={channelName}
        enabled={enabled}
        onSubscribed={handleBoardRealtimeSubscribed}
        {...realtimeCallbacks}
      />
      {filtersAreActive && visibleCardCount === 0 && (
        <div className="mb-3 inline-flex rounded-lg bg-white/90 px-3 py-2 text-sm font-medium text-neutral-700 shadow-sm">
          Không có thẻ nào phù hợp với bộ lọc hiện tại.
        </div>
      )}
      <DragDropContext
        onDragStart={canEdit ? onDragStart : () => undefined}
        onDragEnd={canEdit ? onDragEnd : () => undefined}
      >
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
                    canEdit={canEdit}
                  />
                )
              })}
              {provided.placeholder}
              {canEdit && <ListForm />}
              <div className="flex-shrink-0 w-1" />
            </ol>
          )}
        </Droppable>
      </DragDropContext>
      </div>
    </BoardStateProvider>
  );
};
