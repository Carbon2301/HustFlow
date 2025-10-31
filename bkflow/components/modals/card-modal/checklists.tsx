"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { BoardMember, Checklist } from "@prisma/client";
import {
  DragDropContext,
  Draggable,
  Droppable,
  type DropResult,
} from "@hello-pangea/dnd";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { assignChecklistItem } from "@/actions/assign-checklist-item";
import { createChecklistItem } from "@/actions/create-checklist-item";
import { deleteChecklist } from "@/actions/delete-checklist";
import { deleteChecklistItem } from "@/actions/delete-checklist-item";
import { moveChecklistItem } from "@/actions/move-checklist-item";
import { renameChecklistItem } from "@/actions/rename-checklist-item";
import { reorderChecklistItems } from "@/actions/reorder-checklist-items";
import { setChecklistItemDueDate } from "@/actions/set-checklist-item-due-date";
import { toggleChecklistItem } from "@/actions/toggle-checklist-item";
import { updateChecklist } from "@/actions/update-checklist";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAction } from "@/hooks/use-action";
import { ChecklistItemWithAssignee } from "@/types";
import { cn } from "@/lib/utils";

import { ChecklistHeader } from "./checklist-header";
import { ChecklistItem } from "./checklist-item";
import { ChecklistProgress } from "./checklist-progress";

type ChecklistWithItems = Checklist & {
  items: ChecklistItemWithAssignee[];
};

interface ChecklistsProps {
  cardId: string;
  boardId: string;
  boardMembers: BoardMember[];
  checklists: ChecklistWithItems[];
}

const reorder = <T,>(list: T[], startIndex: number, endIndex: number) => {
  const result = Array.from(list);
  const [removed] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, removed);

  return result;
};

const getDestinationIndex = ({
  actualItems,
  visibleItems,
  destinationIndex,
}: {
  actualItems: ChecklistItemWithAssignee[];
  visibleItems: ChecklistItemWithAssignee[];
  destinationIndex: number;
}) => {
  const targetVisibleItem = visibleItems[destinationIndex];

  if (targetVisibleItem) {
    return actualItems.findIndex((item) => item.id === targetVisibleItem.id);
  }

  const lastVisibleItem = visibleItems[destinationIndex - 1];

  if (lastVisibleItem) {
    const lastVisibleIndex = actualItems.findIndex(
      (item) => item.id === lastVisibleItem.id,
    );

    return lastVisibleIndex + 1;
  }

  return actualItems.length;
};

export const Checklists = ({
  cardId,
  boardId,
  boardMembers,
  checklists,
}: ChecklistsProps) => {
  const queryClient = useQueryClient();
  const [localChecklists, setLocalChecklists] = useState(checklists);
  const [hideCompleted, setHideCompleted] = useState<Record<string, boolean>>({});
  const [activeChecklistIdForNewItem, setActiveChecklistIdForNewItem] = useState<string | null>(null);
  const [newItemTitle, setNewItemTitle] = useState("");
  const [pendingToggleItemIds, setPendingToggleItemIds] = useState<Set<string>>(new Set());
  const [pendingItemIds, setPendingItemIds] = useState<Set<string>>(new Set());
  const [pendingChecklistIds, setPendingChecklistIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setLocalChecklists(checklists);
  }, [checklists]);

  const invalidateCard = (includeLogs: boolean) => {
    queryClient.invalidateQueries({ queryKey: ["card", cardId] });

    if (includeLogs) {
      queryClient.invalidateQueries({ queryKey: ["card-logs", cardId] });
    }
  };

  const setItemPending = (itemId: string, pending: boolean) => {
    setPendingItemIds((current) => {
      const next = new Set(current);
      if (pending) {
        next.add(itemId);
      } else {
        next.delete(itemId);
      }
      return next;
    });
  };

  const setTogglePending = (itemId: string, pending: boolean) => {
    setPendingToggleItemIds((current) => {
      const next = new Set(current);
      if (pending) {
        next.add(itemId);
      } else {
        next.delete(itemId);
      }
      return next;
    });
  };

  const setChecklistPending = (checklistId: string, pending: boolean) => {
    setPendingChecklistIds((current) => {
      const next = new Set(current);
      if (pending) {
        next.add(checklistId);
      } else {
        next.delete(checklistId);
      }
      return next;
    });
  };

  const updateLocalItem = (
    itemId: string,
    updater: (item: ChecklistItemWithAssignee) => ChecklistItemWithAssignee,
  ) => {
    setLocalChecklists((current) =>
      current.map((checklist) => ({
        ...checklist,
        items: checklist.items.map((item) =>
          item.id === itemId ? updater(item) : item
        ),
      })),
    );
  };

  const { execute: executeDeleteChecklist } = useAction(deleteChecklist, {
    onSuccess: (data) => {
      toast.success(`Đã xoá danh sách "${data.title}"`);
      invalidateCard(true);
    },
    onError: (error) => toast.error(error),
  });

  const { execute: executeCreateItem, isLoading: isCreatingItem } = useAction(createChecklistItem, {
    onSuccess: () => {
      toast.success("Đã thêm mục mới");
      setNewItemTitle("");
      invalidateCard(false);
    },
    onError: (error) => toast.error(error),
  });

  const { execute: executeUpdateChecklist } = useAction(updateChecklist, {
    onSuccess: () => invalidateCard(true),
    onError: (error) => toast.error(error),
  });

  const { execute: executeRenameItem } = useAction(renameChecklistItem, {
    onSuccess: () => invalidateCard(true),
    onError: (error) => toast.error(error),
  });

  const { execute: executeToggleItem } = useAction(toggleChecklistItem, {
    onSuccess: () => invalidateCard(true),
    onError: (error) => toast.error(error),
  });

  const { execute: executeSetDueDate } = useAction(setChecklistItemDueDate, {
    onSuccess: () => invalidateCard(true),
    onError: (error) => toast.error(error),
  });

  const { execute: executeAssignItem } = useAction(assignChecklistItem, {
    onSuccess: (data) => {
      if (data.cardMemberAdded) {
        toast.success("Đã giao thành viên vào checklist và tự động thêm vào thẻ.");
      } else if (data.item.assigneeId) {
        toast.success("Đã giao thành viên vào checklist.");
      } else {
        toast.success("Đã bỏ giao thành viên khỏi checklist.");
      }
      invalidateCard(true);
    },
    onError: (error) => toast.error(error),
  });

  const { execute: executeDeleteItem } = useAction(deleteChecklistItem, {
    onSuccess: () => {
      toast.success("Đã xoá mục công việc");
      invalidateCard(false);
    },
    onError: (error) => toast.error(error),
  });

  const { execute: executeReorderItems } = useAction(reorderChecklistItems, {
    onError: (error) => {
      toast.error(error);
      // Revert optimistic state on failure by re-syncing with server
      invalidateCard(false);
    },
  });

  const { execute: executeMoveItem } = useAction(moveChecklistItem, {
    onError: (error) => {
      toast.error(error);
      invalidateCard(false);
    },
  });

  const boardMembersById = useMemo(() => {
    return new Map(boardMembers.map((member) => [member.id, member]));
  }, [boardMembers]);

  const handleRenameChecklist = async (checklistId: string, title: string) => {
    setChecklistPending(checklistId, true);
    setLocalChecklists((current) =>
      current.map((checklist) =>
        checklist.id === checklistId ? { ...checklist, title } : checklist
      ),
    );

    try {
      await executeUpdateChecklist({ boardId, cardId, id: checklistId, title });
    } finally {
      setChecklistPending(checklistId, false);
    }
  };

  const handleCreateItem = (event: React.FormEvent, checklistId: string) => {
    event.preventDefault();
    const title = newItemTitle.trim();

    if (!title) {
      return;
    }

    executeCreateItem({
      boardId,
      cardId,
      checklistId,
      title,
    });
  };

  const handleRenameItem = async (itemId: string, title: string) => {
    setItemPending(itemId, true);
    updateLocalItem(itemId, (item) => ({ ...item, title }));

    try {
      await executeRenameItem({ boardId, cardId, id: itemId, title });
    } finally {
      setItemPending(itemId, false);
    }
  };

  const handleToggleItem = async (itemId: string, isCompleted: boolean) => {
    if (pendingToggleItemIds.has(itemId)) {
      return;
    }

    setTogglePending(itemId, true);
    updateLocalItem(itemId, (item) => ({ ...item, isCompleted }));

    try {
      await executeToggleItem({ boardId, cardId, id: itemId, isCompleted });
    } finally {
      setTogglePending(itemId, false);
    }
  };

  const handleSetDueDate = async (itemId: string, dueDate: Date | null) => {
    setItemPending(itemId, true);
    updateLocalItem(itemId, (item) => ({ ...item, dueDate }));

    try {
      await executeSetDueDate({ boardId, cardId, id: itemId, dueDate });
    } finally {
      setItemPending(itemId, false);
    }
  };

  const handleAssignItem = async (itemId: string, assigneeId: string | null) => {
    const assignee = assigneeId ? boardMembersById.get(assigneeId) ?? null : null;

    setItemPending(itemId, true);
    updateLocalItem(itemId, (item) => ({ ...item, assigneeId, assignee }));

    try {
      await executeAssignItem({ boardId, cardId, id: itemId, assigneeId });
    } finally {
      setItemPending(itemId, false);
    }
  };

  const handleDeleteItem = (itemId: string) => {
    setLocalChecklists((current) =>
      current.map((checklist) => ({
        ...checklist,
        items: checklist.items.filter((item) => item.id !== itemId),
      })),
    );
    executeDeleteItem({ boardId, cardId, id: itemId });
  };

  const onDragEnd = (result: DropResult) => {
    const { destination, source } = result;

    if (!destination) {
      return;
    }

    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    const sourceChecklistId = source.droppableId.replace("checklist:", "");
    const destinationChecklistId = destination.droppableId.replace("checklist:", "");
    const sourceChecklist = localChecklists.find((item) => item.id === sourceChecklistId);
    const destinationChecklist = localChecklists.find((item) => item.id === destinationChecklistId);

    if (!sourceChecklist || !destinationChecklist) {
      return;
    }

    const visibleSourceItems = hideCompleted[sourceChecklist.id]
      ? sourceChecklist.items.filter((item) => !item.isCompleted)
      : sourceChecklist.items;
    const visibleDestinationItems = hideCompleted[destinationChecklist.id]
      ? destinationChecklist.items.filter((item) => !item.isCompleted)
      : destinationChecklist.items;
    const sourceItem = visibleSourceItems[source.index];

    if (!sourceItem) {
      return;
    }

    const sourceIndex = sourceChecklist.items.findIndex((item) => item.id === sourceItem.id);
    const destinationIndex = getDestinationIndex({
      actualItems: destinationChecklist.items,
      visibleItems: visibleDestinationItems,
      destinationIndex: destination.index,
    });

    if (sourceIndex === -1 || destinationIndex === -1) {
      return;
    }

    if (sourceChecklistId === destinationChecklistId) {
      const reorderedItems = reorder(
        sourceChecklist.items,
        sourceIndex,
        destinationIndex,
      )
        .map((item, index) => ({ ...item, order: index }));

      setLocalChecklists((current) =>
        current.map((item) =>
          item.id === sourceChecklistId ? { ...item, items: reorderedItems } : item
        ),
      );

      executeReorderItems({
        boardId,
        cardId,
        checklistId: sourceChecklistId,
        items: reorderedItems.map((item) => ({
          id: item.id,
          order: item.order,
        })),
      });
      return;
    }

    const nextSourceItems = sourceChecklist.items
      .filter((item) => item.id !== sourceItem.id)
      .map((item, index) => ({ ...item, order: index }));
    const nextDestinationItems = [...destinationChecklist.items];

    nextDestinationItems.splice(destinationIndex, 0, {
      ...sourceItem,
      checklistId: destinationChecklistId,
    });

    const reorderedDestinationItems = nextDestinationItems.map((item, index) => ({
      ...item,
      checklistId: destinationChecklistId,
      order: index,
    }));

    setLocalChecklists((current) =>
      current.map((item) =>
        item.id === sourceChecklistId
          ? { ...item, items: nextSourceItems }
          : item.id === destinationChecklistId
            ? { ...item, items: reorderedDestinationItems }
            : item
      ),
    );

    executeMoveItem({
      boardId,
      cardId,
      itemId: sourceItem.id,
      sourceChecklistId,
      destinationChecklistId,
      sourceItems: nextSourceItems.map((item) => ({
        id: item.id,
        order: item.order,
      })),
      destinationItems: reorderedDestinationItems.map((item) => ({
        id: item.id,
        order: item.order,
      })),
    });
  };

  if (!localChecklists || localChecklists.length === 0) {
    return null;
  }

  return (
    <div className="flex w-full flex-col gap-y-6">
      <DragDropContext onDragEnd={onDragEnd}>
        {localChecklists.map((checklist) => {
          const completedCount = checklist.items.filter((item) => item.isCompleted).length;
          const isHiding = !!hideCompleted[checklist.id];
          const displayItems = isHiding
            ? checklist.items.filter((item) => !item.isCompleted)
            : checklist.items;

          return (
            <div key={checklist.id} className="flex w-full flex-col gap-y-3">
              <ChecklistHeader
                title={checklist.title}
                completedCount={completedCount}
                isHidingCompleted={isHiding}
                isRenaming={pendingChecklistIds.has(checklist.id)}
                onRename={(title) => handleRenameChecklist(checklist.id, title)}
                onDelete={() => executeDeleteChecklist({ id: checklist.id, boardId, cardId })}
                onToggleHideCompleted={() =>
                  setHideCompleted((current) => ({
                    ...current,
                    [checklist.id]: !current[checklist.id],
                  }))
                }
              />
              <ChecklistProgress
                completedCount={completedCount}
                totalCount={checklist.items.length}
              />
              <Droppable droppableId={`checklist:${checklist.id}`} type="checklist-item">
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={cn(
                      "flex min-h-8 w-full flex-col gap-y-1 pl-[52px]",
                      snapshot.isDraggingOver && "rounded-lg bg-violet-50/50",
                    )}
                  >
                    {displayItems.map((item, index) => (
                      <Draggable key={item.id} draggableId={item.id} index={index}>
                        {(provided, snapshot) => {
                          const child = (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className={cn(snapshot.isDragging && "opacity-90")}
                            >
                              <ChecklistItem
                                item={item}
                                boardMembers={boardMembers}
                                dragHandleProps={provided.dragHandleProps}
                                isDragging={snapshot.isDragging}
                                isMutating={pendingItemIds.has(item.id)}
                                isTogglePending={pendingToggleItemIds.has(item.id)}
                                onAssign={handleAssignItem}
                                onDelete={handleDeleteItem}
                                onRename={handleRenameItem}
                                onSetDueDate={handleSetDueDate}
                                onToggle={handleToggleItem}
                              />
                            </div>
                          );

                          // Render the dragging clone via portal to document.body so it
                          // is not offset by the modal's overflow-y-auto scroll container.
                          if (snapshot.isDragging) {
                            return createPortal(child, document.body);
                          }

                          return child;
                        }}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>

              <div className="pl-[52px]">
                {activeChecklistIdForNewItem === checklist.id ? (
                  <form
                    onSubmit={(event) => handleCreateItem(event, checklist.id)}
                    className="mt-1 space-y-3"
                  >
                    <Input
                      placeholder="Thêm một mục"
                      value={newItemTitle}
                      onChange={(event) => setNewItemTitle(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Escape") {
                          setActiveChecklistIdForNewItem(null);
                          setNewItemTitle("");
                        }
                      }}
                      disabled={isCreatingItem}
                      autoFocus
                      className="h-9.5 w-full rounded-lg border-neutral-200 px-3 text-xs"
                    />
                    <div className="flex items-center gap-x-2">
                      <Button
                        type="submit"
                        disabled={isCreatingItem}
                        className="h-8 rounded-lg bg-violet-600 px-4 text-xs font-semibold text-white hover:bg-violet-700"
                      >
                        Thêm
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          setActiveChecklistIdForNewItem(null);
                          setNewItemTitle("");
                        }}
                        className="h-8 rounded-lg px-3 text-xs font-semibold text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700"
                      >
                        Huỷ
                      </Button>
                    </div>
                  </form>
                ) : (
                  <Button
                    onClick={() => {
                      setActiveChecklistIdForNewItem(checklist.id);
                      setNewItemTitle("");
                    }}
                    variant="outline"
                    className="mt-1 h-8.5 rounded-lg border-neutral-200 px-3 text-xs font-semibold text-neutral-600 hover:bg-neutral-50"
                  >
                    Thêm một mục
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </DragDropContext>
    </div>
  );
};
