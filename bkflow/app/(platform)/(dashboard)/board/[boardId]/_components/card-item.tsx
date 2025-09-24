"use client";

import { useState, useRef } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { Draggable } from "@hello-pangea/dnd";
import { AlignLeft, ExternalLink, Copy, Trash2 } from "lucide-react";

import { useCardModal } from "@/hooks/use-card-modal";
import { DueDateBadge } from "@/components/due-date-badge";
import { Hint } from "@/components/hint";
import { CardWithAssignees } from "@/types";
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarImage,
} from "@/components/ui/avatar";
import { useAction } from "@/hooks/use-action";
import { copyCard } from "@/actions/copy-card";
import { deleteCard } from "@/actions/delete-card";
import { cn } from "@/lib/utils";

interface CardItemProps {
  data: CardWithAssignees;
  index: number;
}

const getInitials = (name: string) => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const initials = words.slice(0, 2).map((word) => word[0]).join("");

  return initials.toUpperCase() || "U";
};

export const CardItem = ({
  data,
  index,
}: CardItemProps) => {
  const cardModal = useCardModal();
  const params = useParams();
  
  const [showMenu, setShowMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const cardRef = useRef<HTMLDivElement>(null);

  const handleContextMenu = (e: React.MouseEvent) => {
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
    }

    setShowMenu(true);
  };

  const { execute: executeCopyCard, isLoading: isLoadingCopy } = useAction(copyCard, {
    onSuccess: (copiedCard) => {
      toast.success(`Đã sao chép thẻ "${copiedCard.title}"`);
      setShowMenu(false);
    },
    onError: (error) => {
      toast.error(error);
    },
  });

  const { execute: executeDeleteCard, isLoading: isLoadingDelete } = useAction(deleteCard, {
    onSuccess: (deletedCard) => {
      toast.success(`Đã xóa thẻ "${deletedCard.title}"`);
      setShowMenu(false);
    },
    onError: (error) => {
      toast.error(error);
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
    const boardId = params.boardId as string;
    executeCopyCard({ id: data.id, boardId });
  };

  const onDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    const boardId = params.boardId as string;
    executeDeleteCard({ id: data.id, boardId });
  };

  const visibleAssignees = data.assignees.slice(0, 3);
  const hiddenAssigneesCount = Math.max(data.assignees.length - visibleAssignees.length, 0);
  const hasFooter = Boolean(data.dueDate) || data.assignees.length > 0;

  return (
    <Draggable draggableId={data.id} index={index}>
      {(provided, snapshot) => {
        const combinedRef = (node: HTMLDivElement | null) => {
          provided.innerRef(node);
          cardRef.current = node;
        };

        return (
          <div
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            ref={combinedRef}
            role="button"
            onClick={() => onOpen()}
            onContextMenu={handleContextMenu}
            className={cn(
              "group flex items-start gap-x-2 border border-transparent hover:border-violet-200 py-2.5 px-3 text-sm bg-white rounded-lg shadow-sm hover:shadow transition-all duration-150 !cursor-pointer select-none",
              snapshot.isDragging && "shadow-md rotate-1 opacity-90 border-violet-300",
              showMenu && "relative z-[100] ring-2 ring-violet-500 shadow-xl"
            )}
          >
            <div className="flex-1 min-w-0 space-y-2">
              <span className="block leading-snug text-neutral-700 break-words">
                {data.title}
              </span>
              {hasFooter && (
                <div className="flex min-h-7 items-center justify-between gap-x-2">
                  <div className="min-w-0">
                    {data.dueDate && (
                      <DueDateBadge
                        dueDate={data.dueDate}
                        isCompleted={data.isCompleted}
                      />
                    )}
                  </div>
                  {data.assignees.length > 0 && (
                    <AvatarGroup className="-mr-1 ml-auto flex-shrink-0 -space-x-1.5 *:data-[slot=avatar]:ring-white">
                      {visibleAssignees.map((assignee) => (
                        <Hint
                          key={assignee.id}
                          description={assignee.boardMember.userName}
                        >
                          <Avatar size="sm" className="h-6 w-6 bg-white">
                            <AvatarImage
                              src={assignee.boardMember.userImage}
                              alt={assignee.boardMember.userName}
                            />
                            <AvatarFallback className="text-[10px] font-semibold">
                              {getInitials(assignee.boardMember.userName)}
                            </AvatarFallback>
                          </Avatar>
                        </Hint>
                      ))}
                      {hiddenAssigneesCount > 0 && (
                        <Hint description={`Còn ${hiddenAssigneesCount} người phụ trách khác`}>
                          <div className="relative flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-neutral-100 px-1.5 text-[10px] font-semibold text-neutral-600 ring-2 ring-white">
                            +{hiddenAssigneesCount}
                          </div>
                        </Hint>
                      )}
                    </AvatarGroup>
                  )}
                </div>
              )}
            </div>
            {data.description && (
              <Hint description="Thẻ đã có mô tả" side="bottom">
                <AlignLeft className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-neutral-300 group-hover:text-neutral-400 transition-colors" />
              </Hint>
            )}

            {showMenu && (
              <>
                {/* Backdrop overlay */}
                <div
                  className="fixed inset-0 bg-black/50 z-[99] cursor-default"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(false);
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowMenu(false);
                  }}
                />
                {/* Context Menu */}
                <div
                  className="fixed z-[100] w-52 bg-white rounded-xl shadow-2xl border border-neutral-200 p-1.5 flex flex-col gap-y-1"
                  style={{
                    top: menuPosition.top,
                    left: menuPosition.left,
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={(e) => onOpen(e)}
                    className="w-full flex items-center gap-x-2.5 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer"
                  >
                    <ExternalLink className="h-4 w-4 text-neutral-400" />
                    Mở thẻ
                  </button>
                  <button
                    onClick={onCopy}
                    disabled={isLoadingCopy || isLoadingDelete}
                    className="w-full flex items-center gap-x-2.5 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-50 rounded-lg transition-colors cursor-pointer"
                  >
                    <Copy className="h-4 w-4 text-neutral-400" />
                    {isLoadingCopy ? "Đang sao chép…" : "Sao chép thẻ"}
                  </button>
                  <button
                    onClick={onDelete}
                    disabled={isLoadingCopy || isLoadingDelete}
                    className="w-full flex items-center gap-x-2.5 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 rounded-lg transition-colors cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                    {isLoadingDelete ? "Đang xóa…" : "Xóa thẻ"}
                  </button>
                </div>
              </>
            )}
          </div>
        );
      }}
    </Draggable>
  );
};
