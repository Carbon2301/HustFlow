"use client";

import { useEffect, useRef, useState } from "react";
import { CheckSquare } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ChecklistHeaderProps {
  title: string;
  completedCount: number;
  isHidingCompleted: boolean;
  isRenaming: boolean;
  onDelete: () => void;
  onRename: (title: string) => void;
  onToggleHideCompleted: () => void;
}

export const ChecklistHeader = ({
  title,
  completedCount,
  isHidingCompleted,
  isRenaming,
  onDelete,
  onRename,
  onToggleHideCompleted,
}: ChecklistHeaderProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(title);

  useEffect(() => {
    setDraftTitle(title);
  }, [title]);

  const startEditing = () => {
    setIsEditing(true);
    setTimeout(() => inputRef.current?.focus());
  };

  const cancelEditing = () => {
    setDraftTitle(title);
    setIsEditing(false);
  };

  const save = () => {
    const nextTitle = draftTitle.trim();

    if (!nextTitle || nextTitle === title) {
      cancelEditing();
      return;
    }

    onRename(nextTitle);
    setIsEditing(false);
  };

  return (
    <div className="flex items-start justify-between gap-x-3 w-full">
      <div className="flex min-w-0 items-start gap-x-3.5">
        <div className="w-10 h-10 rounded-xl bg-neutral-100 flex items-center justify-center flex-shrink-0">
          <CheckSquare className="h-5 w-5 text-neutral-500" />
        </div>
        {isEditing ? (
          <Input
            ref={inputRef}
            value={draftTitle}
            onChange={(event) => setDraftTitle(event.target.value)}
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
            disabled={isRenaming}
            className="h-9 min-w-0 rounded-lg border-violet-400 text-base font-semibold focus-visible:ring-1 focus-visible:ring-violet-200"
            aria-label="Đổi tên danh sách công việc"
          />
        ) : (
          <button
            type="button"
            onClick={startEditing}
            className="min-w-0 rounded-md px-1 py-1 text-left text-base font-semibold text-neutral-800 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
          >
            <span className="block break-words">{title}</span>
          </button>
        )}
      </div>
      <div className="flex shrink-0 flex-wrap justify-end gap-2">
        {completedCount > 0 && (
          <Button
            onClick={onToggleHideCompleted}
            variant="outline"
            size="sm"
            className="h-8 rounded-lg border-neutral-200 text-xs text-neutral-600 hover:bg-neutral-50 font-semibold cursor-pointer"
          >
            {isHidingCompleted ? "Hiện đã hoàn thành" : "Ẩn đã hoàn thành"}
          </Button>
        )}
        <Button
          onClick={onDelete}
          variant="outline"
          size="sm"
          className="h-8 rounded-lg border-neutral-200 text-xs text-neutral-600 hover:bg-neutral-50 font-semibold cursor-pointer"
        >
          Xoá
        </Button>
      </div>
    </div>
  );
};
