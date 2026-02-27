"use client";

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
  enableCalendarDragHandle = false,
}: ListContainerProps) => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const cardModal = useCardModal();
  const invalidateBoardCalendar = useBoardCalendarInvalidation(boardId);
  const filters = useBoardFilters((state) =>
    state.filtersByBoardId[boardId] ?? emptyBoardFilters,
  );

  const { execute: executeUpdateListOrder } = useAction(updateListOrder, {
    onError: (error) => {
      toast.error(error);
    },
  });

  const { execute: executeUpdateCardOrder } = useAction(updateCardOrder, {
    onError: (error) => {
      toast.error(error);
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
  });

  const realtimeCallbacks = useBoardRealtimeSync({
    boardId,
    currentUserId,
    cardModal,
    router,
    queryClient,
    orderedData,
    setOrderedData,
  });
  const channelName = realtimeChannels.board(boardId);
  const enabled = isRealtimeClientConfigured();

  return (
    <BoardStateProvider boardId={boardId} data={orderedData} setData={setOrderedData}>
      <div className="h-full">
      <BoardRealtimeSubscriptions
        channelName={channelName}
        enabled={enabled}
        {...realtimeCallbacks}
      />
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
    </BoardStateProvider>
  );
};
