"use client";

import { useState } from "react";
import { BoardMember } from "@prisma/client";
import type { DraggableProvidedDragHandleProps } from "@hello-pangea/dnd";
import { GripVertical } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ChecklistItemWithAssignee } from "@/types";

import { ChecklistItemActions } from "./checklist-item-actions";
import { ChecklistItemAssignee } from "./checklist-item-assignee";
import { ChecklistItemDueDate } from "./checklist-item-due-date";

interface ChecklistItemProps {
  item: ChecklistItemWithAssignee;
  boardMembers: BoardMember[];
  isMutating: boolean;
  isTogglePending: boolean;
  dragHandleProps: DraggableProvidedDragHandleProps | null | undefined;
  onAssign: (itemId: string, assigneeId: string | null) => void;
  onDelete: (itemId: string) => void;
  onRename: (itemId: string, title: string) => void;
  onSetDueDate: (itemId: string, dueDate: Date | null) => void;
  onToggle: (itemId: string, isCompleted: boolean) => void;
}

export const ChecklistItem = ({
  item,
  boardMembers,
  isMutating,
  isTogglePending,
  dragHandleProps,
  onAssign,
  onDelete,
  onRename,
  onSetDueDate,
  onToggle,
}: ChecklistItemProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(item.title);

  const cancelEditing = () => {
    setTitle(item.title);
    setIsEditing(false);
  };

  const save = () => {
    const nextTitle = title.trim();

    if (!nextTitle || nextTitle === item.title) {
      cancelEditing();
      return;
    }

    onRename(item.id, nextTitle);
    setIsEditing(false);
  };

  return (
    <div className="group flex w-full items-start justify-between gap-x-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-neutral-50">
      <div className="flex min-w-0 flex-1 items-start gap-x-2.5">
        <button
          type="button"
          {...dragHandleProps}
          className="mt-1 rounded p-0.5 text-neutral-300 transition hover:bg-neutral-100 hover:text-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
          aria-label="Kéo để sắp xếp mục công việc"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <input
          type="checkbox"
          checked={item.isCompleted}
          disabled={isTogglePending}
          onChange={(event) => onToggle(item.id, event.target.checked)}
          className="mt-1 h-4.5 w-4.5 rounded-md border-neutral-300 accent-violet-600 shadow-xs disabled:opacity-50"
          aria-label={item.isCompleted ? "Bỏ hoàn thành" : "Hoàn thành"}
        />
        <div className="min-w-0 flex-1">
          {isEditing ? (
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              onBlur={save}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  save();
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  cancelEditing();
                }
              }}
              autoFocus
              disabled={isMutating}
              className="h-8 min-w-0 rounded-md border-violet-400 px-2 py-1 text-sm focus-visible:ring-1 focus-visible:ring-violet-200"
              aria-label="Đổi tên mục công việc"
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                setTitle(item.title);
                setIsEditing(true);
              }}
              className={cn(
                "block w-full rounded px-1 py-0.5 text-left text-sm leading-relaxed text-neutral-700 break-words focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300",
                item.isCompleted && "text-neutral-400 line-through",
              )}
            >
              {item.title}
            </button>
          )}
          {item.dueDate && (
            <div className="mt-1 flex">
              <ChecklistItemDueDate
                dueDate={item.dueDate}
                isCompleted={item.isCompleted}
                isPending={isMutating}
                onChange={(dueDate) => onSetDueDate(item.id, dueDate)}
              />
            </div>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-x-1">
        {!item.dueDate && (
          <ChecklistItemDueDate
            dueDate={item.dueDate}
            isCompleted={item.isCompleted}
            isPending={isMutating}
            onChange={(dueDate) => onSetDueDate(item.id, dueDate)}
          />
        )}
        <ChecklistItemAssignee
          assignee={item.assignee}
          boardMembers={boardMembers}
          isPending={isMutating}
          onChange={(assigneeId) => onAssign(item.id, assigneeId)}
        />
        <ChecklistItemActions
          isPending={isMutating}
          onDelete={() => onDelete(item.id)}
        />
      </div>
    </div>
  );
};
