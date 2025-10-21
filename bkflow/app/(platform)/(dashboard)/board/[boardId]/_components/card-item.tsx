"use client";

import { useState, useRef } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { Draggable } from "@hello-pangea/dnd";
import { AlignLeft, ExternalLink, Copy, Trash2, MessageSquare, CheckSquare } from "lucide-react";

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
import { cn, getColorName } from "@/lib/utils";

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

  // Checklist progress
  const checklistTotalItems = data.checklists?.reduce((acc, cl) => acc + cl.items.length, 0) ?? 0;
  const checklistCompletedItems = data.checklists?.reduce(
    (acc, cl) => acc + cl.items.filter((item) => item.isCompleted).length,
    0,
  ) ?? 0;
  const hasChecklistProgress = checklistTotalItems > 0;
  const isChecklistAllDone = hasChecklistProgress && checklistCompletedItems === checklistTotalItems;

  const hasFooter = Boolean(data.dueDate) || data.isCompleted || data.assignees.length > 0
    || Boolean(data._count && data._count.comments > 0) || hasChecklistProgress;

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
              "group relative flex flex-col justify-between border border-transparent hover:border-violet-200 pb-2.5 px-3 text-sm bg-white rounded-lg shadow-sm hover:shadow transition-all duration-150 !cursor-pointer select-none overflow-hidden",
              data.labels && data.labels.length > 0 ? "pt-4.5" : "pt-2.5",
              snapshot.isDragging && "shadow-md rotate-1 opacity-90 border-violet-300",
              showMenu && "relative z-[100] ring-2 ring-violet-500 shadow-xl"
            )}
          >
            {data.labels && data.labels.length > 0 && (
              <div className="absolute top-0 left-0 right-0 flex h-2 gap-x-0.5">
                {data.labels.map((cardLabel) => (
                  <Hint
                    key={cardLabel.id}
                    description={`Màu: ${getColorName(cardLabel.label.color)}, Tiêu đề: ${cardLabel.label.title || "Không"}`}
                    side="top"
                    sideOffset={4}
                  >
                    <div
                      className="h-full flex-1"
                      style={{ backgroundColor: cardLabel.label.color }}
                    />
                  </Hint>
                ))}
              </div>
            )}
            <div className="w-full space-y-2">
              <span className={cn(
                "block text-[15px] font-semibold leading-snug text-neutral-800 break-words",
                data.description && "pr-5"
              )}>
                {data.title}
              </span>
              {hasFooter && (
                <div className="flex min-h-7 flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
                  <div className="flex items-center gap-x-2 flex-wrap gap-y-1">
                    {data.dueDate && (
                      <DueDateBadge
                        dueDate={data.dueDate}
                        isCompleted={data.isCompleted}
                      />
                    )}
                    {!data.dueDate && data.isCompleted && (
                      <Hint description="Thẻ đã hoàn thành" side="bottom">
                        <span className="inline-flex h-7 items-center gap-x-1 rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700 px-2 py-0.5 text-xs font-semibold shadow-xs">
                          <CheckSquare className="h-3 w-3.5 text-emerald-600 shrink-0" />
                          Hoàn thành
                        </span>
                      </Hint>
                    )}
                    {data._count && data._count.comments > 0 && (
                      <Hint description={`${data._count.comments} bình luận`} side="bottom">
                        <div className="flex items-center gap-x-1 text-xs text-neutral-400 hover:text-neutral-600 transition-colors py-0.5 px-1.5 rounded bg-neutral-50 hover:bg-neutral-100/70 border border-neutral-100">
                          <MessageSquare className="h-3.5 w-3.5 text-neutral-400 flex-shrink-0" />
                          <span className="font-semibold text-neutral-500 leading-none">{data._count.comments}</span>
                        </div>
                      </Hint>
                    )}
                    {hasChecklistProgress && (
                      <Hint description={`${checklistCompletedItems}/${checklistTotalItems} mục hoàn thành`} side="bottom">
                        <div className={cn(
                          "flex items-center gap-x-1 text-xs py-0.5 px-1.5 rounded border transition-colors",
                          isChecklistAllDone
                            ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                            : "bg-neutral-50 border-neutral-100 text-neutral-500 hover:bg-neutral-100/70",
                        )}>
                          <CheckSquare className={cn("h-3.5 w-3.5 flex-shrink-0", isChecklistAllDone ? "text-emerald-600" : "text-neutral-400")} />
                          <span className="font-semibold leading-none">
                            {checklistCompletedItems}/{checklistTotalItems}
                          </span>
                        </div>
                      </Hint>
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
              <div className="absolute top-3 right-3 text-neutral-300 group-hover:text-neutral-400 transition-colors">
                <Hint description="Thẻ đã có mô tả" side="bottom">
                  <AlignLeft className="h-3.5 w-3.5" />
                </Hint>
              </div>
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
