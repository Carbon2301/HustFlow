"use client";

import { memo, useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { Draggable } from "@hello-pangea/dnd";
import { AlignLeft } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { useCardModal } from "@/hooks/use-card-modal";
import { Hint } from "@/components/hint";
import { CardWithAssignees } from "@/types";
import { useAction } from "@/hooks/use-action";
import { archiveCard } from "@/actions/cards/archive-card";
import { updateCard } from "@/actions/cards/update-card";
import { cn } from "@/lib/utils";
import type { ListWithCards } from "@/types";
import { CopyCardDialog } from "@/components/modals/card-modal/copy-card-dialog";

import { useBoardState } from "./board-state-context";
import { CardBadges, CardLabels } from "./card-badges";
import { CardContextMenu } from "./card-context-menu";

interface CardItemProps {
  data: CardWithAssignees;
  index: number;
  canEdit: boolean;
}

export const CardItem = memo(function CardItem({
  data,
  index,
  canEdit,
}: CardItemProps) {
  const cardModal = useCardModal();
  const params = useParams();
  const boardId = params.boardId as string;
  const boardState = useBoardState();
  const queryClient = useQueryClient();
  
  const [showMenu, setShowMenu] = useState(false);
  const [copyDialogOpen, setCopyDialogOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const [triggerRect, setTriggerRect] = useState<DOMRect | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const archiveRollbackRef = useRef<ListWithCards[] | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const titleRollbackRef = useRef<string | null>(null);

  useEffect(() => {
    if (!showMenu) return;

    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      
      // If the click is inside the context menu, let the click happen normally.
      if (target.closest("[data-context-menu]")) {
        return;
      }

      // If clicked outside, close the menu, stop propagation and prevent default action
      e.preventDefault();
      e.stopPropagation();
      setShowMenu(false);
    };

    // Use capture to intercept clicks before they reach target elements (like other cards)
    document.addEventListener("click", handleOutsideClick, { capture: true });
    document.addEventListener("contextmenu", handleOutsideClick, { capture: true });

    return () => {
      document.removeEventListener("click", handleOutsideClick, { capture: true });
      document.removeEventListener("contextmenu", handleOutsideClick, { capture: true });
    };
  }, [showMenu]);

  const { execute: executeUpdateCard, isLoading: isLoadingUpdate } = useAction(updateCard, {
    onSuccess: (updatedCard) => {
      boardState.patchCard(updatedCard.id, { title: updatedCard.title });
      titleRollbackRef.current = null;
      disableEditing();
    },
    onError: (error) => {
      if (titleRollbackRef.current !== null) {
        boardState.patchCard(data.id, { title: titleRollbackRef.current });
        queryClient.setQueryData(["card", data.id], (current: CardWithAssignees | undefined) =>
          current ? { ...current, title: titleRollbackRef.current } : current,
        );
        titleRollbackRef.current = null;
      }
      toast.error(error);
      if (textareaRef.current) {
        textareaRef.current.value = data.title;
      }
      disableEditing();
    },
  });

  const enableEditing = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canEdit) {
      return;
    }

    setShowMenu(false);
    setIsEditing(true);
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const titleLength = textareaRef.current.value.length;
        textareaRef.current.setSelectionRange(titleLength, titleLength);
      }
    }, 0);
  };

  const disableEditing = () => {
    setIsEditing(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Escape") {
      disableEditing();
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      formRef.current?.requestSubmit();
    }
  };

  const onBlur = () => {
    formRef.current?.requestSubmit();
  };

  const onSubmit = (formData: FormData) => {
    const title = formData.get("title") as string;
    const trimmedTitle = title.trim();
    const boardId = params.boardId as string;

    if (!trimmedTitle) {
      if (textareaRef.current) {
        textareaRef.current.value = data.title;
      }
      disableEditing();
      return;
    }

    if (trimmedTitle === data.title) {
      disableEditing();
      return;
    }

    titleRollbackRef.current = data.title;
    boardState.patchCard(data.id, { title: trimmedTitle });
    queryClient.setQueryData(["card", data.id], (current: CardWithAssignees | undefined) =>
      current ? { ...current, title: trimmedTitle } : current,
    );
    disableEditing();

    executeUpdateCard({
      id: data.id,
      title: trimmedTitle,
      boardId,
    });
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    if (!canEdit) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    const rect = cardRef.current?.getBoundingClientRect();

    if (rect) {
      const menuWidth = 208;
      const gap = 8;
      const hasSpaceRight = window.innerWidth - rect.right >= menuWidth + gap;

      setMenuPosition({
        top: Math.max(8, rect.top),
        left: hasSpaceRight
          ? rect.right + gap
          : Math.max(8, rect.left - menuWidth - gap),
      });
      setTriggerRect(rect);
    }

    setShowMenu(true);
  };

  const { execute: executeArchiveCard, isLoading: isLoadingArchive } = useAction(archiveCard, {
    onSuccess: () => {
      setShowMenu(false);
      archiveRollbackRef.current = null;
    },
    onError: (error) => {
      if (archiveRollbackRef.current) {
        boardState.resetToSnapshot(archiveRollbackRef.current);
      }

      toast.error(error);
      archiveRollbackRef.current = null;
    },
  });

  const onOpen = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    setShowMenu(false);
    cardModal.onOpen(data.id);
  };

  const onCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);
    const rect = cardRef.current?.getBoundingClientRect();
    if (rect) {
      setTriggerRect(rect);
    }
    setCopyDialogOpen(true);
  };

  const onArchive = (e: React.MouseEvent) => {
    e.stopPropagation();
    archiveRollbackRef.current = boardState.getSnapshot();
    boardState.removeCard(data.id);
    executeArchiveCard({ id: data.id, boardId });
  };

  return (
    <>
      <Draggable draggableId={data.id} index={index} isDragDisabled={!canEdit}>
      {(provided, snapshot) => {
        const combinedRef = (node: HTMLDivElement | null) => {
          provided.innerRef(node);
          cardRef.current = node;
        };

        const cardContent = (
          <div
            {...provided.draggableProps}
            {...(canEdit ? provided.dragHandleProps : {})}
            ref={combinedRef}
            role="button"
            onClick={() => onOpen()}
            onContextMenu={canEdit ? handleContextMenu : undefined}
            data-active-card={showMenu || copyDialogOpen ? "true" : undefined}
            className={cn(
              "group relative flex flex-col justify-between border border-transparent pb-2.5 px-3 text-sm bg-white rounded-lg shadow-sm transition-[border-color,box-shadow,background-color] duration-100 !cursor-pointer select-none overflow-hidden",
              data.labels && data.labels.length > 0 ? "pt-4.5" : "pt-2.5",
              !snapshot.isDragging && "hover:border-violet-200 hover:shadow",
              snapshot.isDragging && "shadow-sm opacity-95 border-violet-300 z-[9999] pointer-events-none",
              (showMenu || copyDialogOpen) && "relative z-[100] ring-2 ring-violet-500 shadow-xl bg-white"
            )}
          >
            <CardLabels card={data} />
            <div className="w-full space-y-2">
              {isEditing ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    onSubmit(new FormData(e.currentTarget));
                  }}
                  ref={formRef}
                  className="w-full"
                  onClick={(e) => e.stopPropagation()}
                >
                  <textarea
                    ref={textareaRef}
                    name="title"
                    defaultValue={data.title}
                    onKeyDown={onKeyDown}
                    onBlur={onBlur}
                    disabled={isLoadingUpdate}
                    className="w-full text-[15px] font-semibold leading-snug text-neutral-800 break-words resize-none outline-none border border-violet-500 rounded-md px-2 py-1 focus:ring-1 focus:ring-violet-200 bg-white"
                    rows={1}
                  />
                </form>
              ) : (
                <span className={cn(
                  "block text-[15px] font-semibold leading-snug text-neutral-800 break-words",
                  data.description?.trim() && "pr-5"
                )}>
                  {data.title}
                </span>
              )}
              <CardBadges card={data} />
            </div>
            {data.description?.trim() && (
              <div className="absolute right-3 top-3 text-neutral-300 transition-colors group-hover:text-neutral-400">
                <Hint description="Thẻ đã có mô tả" side="bottom">
                  <AlignLeft className="h-3.5 w-3.5" />
                </Hint>
              </div>
            )}

            <CardContextMenu
              isOpen={showMenu}
              canEdit={canEdit}
              position={menuPosition}
              isLoadingArchive={isLoadingArchive}
              onClose={() => setShowMenu(false)}
              onOpen={onOpen}
              onRename={enableEditing}
              onCopy={onCopy}
              onArchive={onArchive}
            />
          </div>
        );

        if (snapshot.isDragging) {
          return createPortal(cardContent, document.body);
        }

        return cardContent;
      }}
      </Draggable>
      {canEdit && (
        <CopyCardDialog
          open={copyDialogOpen}
          onOpenChange={setCopyDialogOpen}
          triggerRect={triggerRect}
          data={{
            ...data,
            list: {
              boardId,
            },
          }}
        />
      )}
    </>
  );
});
