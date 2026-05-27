"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BoardMember } from "@prisma/client";
import {
  DragDropContext,
  Draggable,
  Droppable,
  type DropResult,
} from "@hello-pangea/dnd";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { assignChecklistItem } from "@/actions/checklists/assign-checklist-item";
import { createChecklistItem } from "@/actions/checklists/create-checklist-item";
import { deleteChecklist } from "@/actions/checklists/delete-checklist";
import { deleteChecklistItem } from "@/actions/checklists/delete-checklist-item";
import { moveChecklistItem } from "@/actions/checklists/move-checklist-item";
import { renameChecklistItem } from "@/actions/checklists/rename-checklist-item";
import { reorderChecklistItems } from "@/actions/checklists/reorder-checklist-items";
import { setChecklistItemDueDate } from "@/actions/checklists/set-checklist-item-due-date";
import { toggleChecklistItem } from "@/actions/checklists/toggle-checklist-item";
import { updateChecklist } from "@/actions/checklists/update-checklist";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAction } from "@/hooks/use-action";
import { ChecklistItemWithAssignee } from "@/types";
import { cn } from "@/lib/utils";

import { ChecklistHeader } from "./checklist-header";
import { ChecklistItem } from "./checklist-item";
import { ChecklistProgress } from "./checklist-progress";
import { patchBoardCardPreview } from "../card-cache-utils";
import {
  getChecklistDueDateRangeError as getChecklistDueDateRangeErrorMessage,
  getDestinationIndex,
  parseParentCardDueDate,
  reorder,
  type ChecklistWithItems,
} from "./checklist-utils";

interface ChecklistsProps {
  cardId: string;
  boardId: string;
  cardDueDate: Date | string | null;
  boardMembers: BoardMember[];
  checklists: ChecklistWithItems[];
  canEdit?: boolean;
}

export const ChecklistsSection = ({
  cardId,
  boardId,
  cardDueDate,
  boardMembers,
  checklists,
  canEdit = true,
}: ChecklistsProps) => {
  const queryClient = useQueryClient();
  const [localChecklists, setLocalChecklists] = useState(checklists);
  const [hideCompleted, setHideCompleted] = useState<Record<string, boolean>>({});
  const [activeChecklistIdForNewItem, setActiveChecklistIdForNewItem] = useState<string | null>(null);
  const [newItemTitle, setNewItemTitle] = useState("");
  const [pendingToggleItemIds, setPendingToggleItemIds] = useState<Set<string>>(new Set());
  const [pendingItemIds, setPendingItemIds] = useState<Set<string>>(new Set());
  const [pendingChecklistIds, setPendingChecklistIds] = useState<Set<string>>(new Set());
  const toggleRequestsRef = useRef(new Map<string, {
    previous: boolean;
    queued: boolean | null;
    version: number;
  }>());
  const toggleRequestVersionsRef = useRef(new Map<string, number>());
  const temporaryItemIdRef = useRef<string | null>(null);
  const mutationRollbackRef = useRef<ChecklistWithItems[] | null>(null);

  useEffect(() => {
    setLocalChecklists(checklists);
  }, [checklists]);

  useEffect(() => {
    const total = localChecklists.reduce((count, checklist) => count + checklist.items.length, 0);
    const completed = localChecklists.reduce(
      (count, checklist) => count + checklist.items.filter((item) => item.isCompleted).length,
      0,
    );

    patchBoardCardPreview(boardId, cardId, {
      checklists: localChecklists.map((checklist) => ({
        items: checklist.items.map((item) => ({
          isCompleted: item.isCompleted,
        })),
      })),
      checklistProgress: {
        total,
        completed,
      },
    });
  }, [boardId, cardId, localChecklists]);

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
    onSuccess: (item) => {
      const temporaryItemId = temporaryItemIdRef.current;

      if (temporaryItemId) {
        setLocalChecklists((current) =>
          current.map((checklist) =>
            checklist.id === item.checklistId
              ? {
                ...checklist,
                items: checklist.items.map((currentItem) =>
                  currentItem.id === temporaryItemId ? { ...item, assignee: null } : currentItem
                ),
              }
              : checklist
          ),
        );
      }

      setNewItemTitle("");
      temporaryItemIdRef.current = null;
      invalidateCard(true);
    },
    onError: (error) => {
      const temporaryItemId = temporaryItemIdRef.current;

      if (temporaryItemId) {
        setLocalChecklists((current) =>
          current.map((checklist) => ({
            ...checklist,
            items: checklist.items.filter((item) => item.id !== temporaryItemId),
          })),
        );
      }

      temporaryItemIdRef.current = null;
      toast.error(error);
    },
  });

  const { execute: executeUpdateChecklist } = useAction(updateChecklist, {
    onSuccess: () => {
      mutationRollbackRef.current = null;
      invalidateCard(true);
    },
    onError: (error) => {
      rollbackLocalChecklists();
      toast.error(error);
    },
  });

  const { execute: executeRenameItem } = useAction(renameChecklistItem, {
    onSuccess: () => {
      mutationRollbackRef.current = null;
      invalidateCard(true);
    },
    onError: (error) => {
      rollbackLocalChecklists();
      toast.error(error);
    },
  });

  const getNextToggleRequestVersion = (itemId: string) => {
    const nextVersion = (toggleRequestVersionsRef.current.get(itemId) ?? 0) + 1;
    toggleRequestVersionsRef.current.set(itemId, nextVersion);
    return nextVersion;
  };

  const executeToggleItem = async (itemId: string, isCompleted: boolean, version: number) => {
    const result = await toggleChecklistItem({
      boardId,
      cardId,
      id: itemId,
      isCompleted,
    });

    if (result.error) {
      const request = toggleRequestsRef.current.get(itemId);

      if (request && request.version === version) {
        updateLocalItem(itemId, (item) => ({ ...item, isCompleted: request.previous }));
        toggleRequestsRef.current.delete(itemId);
        setTogglePending(itemId, false);
      }

      toast.error(result.error);
      return;
    }

    if (result.data) {
      const item = result.data;
      const request = toggleRequestsRef.current.get(item.id);

      if (!request || request.version !== version) {
        return;
      }

      const queued = request.queued;
      toggleRequestsRef.current.delete(item.id);
      invalidateCard(true);

      if (queued !== null && queued !== item.isCompleted) {
        sendToggleItem(item.id, queued, item.isCompleted);
        return;
      }

      updateLocalItem(item.id, (currentItem) => ({
        ...currentItem,
        isCompleted: item.isCompleted,
      }));
      setTogglePending(item.id, false);
    }
  };

  const { execute: executeSetDueDate } = useAction(setChecklistItemDueDate, {
    onSuccess: () => {
      mutationRollbackRef.current = null;
      invalidateCard(true);
    },
    onError: (error) => {
      rollbackLocalChecklists();
      toast.error(error);
      invalidateCard(false);
    },
  });

  const { execute: executeAssignItem } = useAction(assignChecklistItem, {
    onSuccess: (data) => {
      mutationRollbackRef.current = null;
      if (data.cardMemberAdded) {
        toast.success("Đã giao thành viên vào checklist và tự động thêm vào thẻ.");
      } else if (data.item.assigneeId) {
        toast.success("Đã giao thành viên vào checklist.");
      } else {
        toast.success("Đã bỏ giao thành viên khỏi checklist.");
      }
      invalidateCard(true);
    },
    onError: (error) => {
      rollbackLocalChecklists();
      toast.error(error);
    },
  });

  const { execute: executeDeleteItem } = useAction(deleteChecklistItem, {
    onSuccess: () => {
      mutationRollbackRef.current = null;
      toast.success("Đã xoá mục công việc");
      invalidateCard(false);
    },
    onError: (error) => {
      rollbackLocalChecklists();
      toast.error(error);
    },
  });

  const { execute: executeReorderItems } = useAction(reorderChecklistItems, {
    onSuccess: () => {
      mutationRollbackRef.current = null;
    },
    onError: (error) => {
      rollbackLocalChecklists();
      toast.error(error);
      // Revert optimistic state on failure by re-syncing with server
      invalidateCard(false);
    },
  });

  const { execute: executeMoveItem } = useAction(moveChecklistItem, {
    onSuccess: () => {
      mutationRollbackRef.current = null;
    },
    onError: (error) => {
      rollbackLocalChecklists();
      toast.error(error);
      invalidateCard(false);
    },
  });

  const boardMembersById = useMemo(() => {
    return new Map(boardMembers.map((member) => [member.id, member]));
  }, [boardMembers]);

  const parentCardDueDate = useMemo(
    () => parseParentCardDueDate(cardDueDate),
    [cardDueDate],
  );

  const getChecklistDueDateRangeError = () => {
    if (!parentCardDueDate) {
      return "Hạn checklist phải trước hoặc bằng hạn chót của thẻ.";
    }

    return `Hạn checklist phải trước hoặc bằng hạn chót của thẻ (${parentCardDueDate.toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })}).`;
  };

  const rollbackLocalChecklists = () => {
    if (mutationRollbackRef.current) {
      setLocalChecklists(mutationRollbackRef.current);
      mutationRollbackRef.current = null;
    }
  };
  void getChecklistDueDateRangeError;

  const handleRenameChecklist = async (checklistId: string, title: string) => {
    setChecklistPending(checklistId, true);
    mutationRollbackRef.current = localChecklists;
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

    const checklist = localChecklists.find((item) => item.id === checklistId);
    const now = new Date();
    const temporaryItemId = `temp-checklist-item-${globalThis.crypto?.randomUUID?.() ?? Date.now().toString()}`;
    const order = checklist
      ? checklist.items.reduce((maxOrder, item) => Math.max(maxOrder, item.order), -1) + 1
      : 0;

    temporaryItemIdRef.current = temporaryItemId;
    setLocalChecklists((current) =>
      current.map((item) =>
        item.id === checklistId
          ? {
            ...item,
            items: [
              ...item.items,
              {
                id: temporaryItemId,
                title,
                order,
                checklistId,
                isCompleted: false,
                dueDate: null,
                assigneeId: null,
                createdAt: now,
                updatedAt: now,
                assignee: null,
              },
            ],
          }
          : item
      ),
    );
    setNewItemTitle("");

    executeCreateItem({
      boardId,
      cardId,
      checklistId,
      title,
    });
  };

  const handleRenameItem = async (itemId: string, title: string) => {
    setItemPending(itemId, true);
    mutationRollbackRef.current = localChecklists;
    updateLocalItem(itemId, (item) => ({ ...item, title }));

    try {
      await executeRenameItem({ boardId, cardId, id: itemId, title });
    } finally {
      setItemPending(itemId, false);
    }
  };

  const sendToggleItem = (itemId: string, isCompleted: boolean, previous: boolean) => {
    const version = getNextToggleRequestVersion(itemId);

    toggleRequestsRef.current.set(itemId, {
      previous,
      queued: null,
      version,
    });
    setTogglePending(itemId, true);
    void executeToggleItem(itemId, isCompleted, version);
  };

  const handleToggleItem = async (itemId: string, isCompleted: boolean) => {
    const activeRequest = toggleRequestsRef.current.get(itemId);
    const currentItem = localChecklists
      .flatMap((checklist) => checklist.items)
      .find((item) => item.id === itemId);

    if (!currentItem) {
      return;
    }

    updateLocalItem(itemId, (item) => ({ ...item, isCompleted }));

    if (activeRequest) {
      activeRequest.queued = isCompleted;
      return;
    }

    sendToggleItem(itemId, isCompleted, currentItem.isCompleted);
  };

  const handleSetDueDate = async (itemId: string, dueDate: Date | null) => {
    if (
      dueDate &&
      parentCardDueDate &&
      dueDate.getTime() > parentCardDueDate.getTime()
    ) {
      toast.error(getChecklistDueDateRangeErrorMessage(parentCardDueDate));
      return;
    }

    setItemPending(itemId, true);
    mutationRollbackRef.current = localChecklists;
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
    mutationRollbackRef.current = localChecklists;
    updateLocalItem(itemId, (item) => ({ ...item, assigneeId, assignee }));

    try {
      await executeAssignItem({ boardId, cardId, id: itemId, assigneeId });
    } finally {
      setItemPending(itemId, false);
    }
  };

  const handleDeleteItem = (itemId: string) => {
    mutationRollbackRef.current = localChecklists;
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

      mutationRollbackRef.current = localChecklists;
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

    mutationRollbackRef.current = localChecklists;
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
      <DragDropContext onDragEnd={canEdit ? onDragEnd : () => undefined}>
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
                canEdit={canEdit}
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
                      <Draggable key={item.id} draggableId={item.id} index={index} isDragDisabled={!canEdit}>
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
                                maxDueDate={parentCardDueDate}
                                onAssign={handleAssignItem}
                                onDelete={handleDeleteItem}
                                onRename={handleRenameItem}
                                onSetDueDate={handleSetDueDate}
                                onToggle={handleToggleItem}
                                canEdit={canEdit}
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

              {canEdit && <div className="pl-[52px]">
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
              </div>}
            </div>
          );
        })}
      </DragDropContext>
    </div>
  );
};
