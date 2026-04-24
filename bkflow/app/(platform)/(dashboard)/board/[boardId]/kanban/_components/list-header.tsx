"use client";

import { toast } from "sonner";
import { useEventListener } from "usehooks-ts";
import { useEffect, useState, useRef } from "react";
import type { DraggableProvidedDragHandleProps } from "@hello-pangea/dnd";

import { useAction } from "@/hooks/use-action";
import { updateList } from "@/actions/update-list";
import { Hint } from "@/components/hint";
import { ListWithCards } from "@/types";
import { ListOptions } from "./list-options";
import { useBoardState } from "./board-state-context";

interface ListHeaderProps {
  data: ListWithCards;
  onAddCard: () => void;
  optionsOpen?: boolean;
  onOptionsOpenChange?: (open: boolean) => void;
  dragHandleProps?: DraggableProvidedDragHandleProps | null;
  canEdit: boolean;
};

export const ListHeader = ({
  data,
  onAddCard,
  optionsOpen,
  onOptionsOpenChange,
  dragHandleProps,
  canEdit,
}: ListHeaderProps) => {
  const [isEditing, setIsEditing] = useState(false);

  const formRef = useRef<HTMLFormElement>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const pointerDownRef = useRef<{
    x: number;
    y: number;
    time: number;
  } | null>(null);
  const boardState = useBoardState();
  const rollbackRef = useRef<ListWithCards[] | null>(null);

  const enableEditing = () => {
    if (!canEdit) {
      return;
    }

    setIsEditing(true);
    setTimeout(() => {
      resizeTitle();
      if (titleRef.current) {
        titleRef.current.focus();
        titleRef.current.setSelectionRange(
          titleRef.current.value.length,
          titleRef.current.value.length
        );
      }
    });
  };

  const resizeTitle = () => {
    const element = titleRef.current;

    if (!element) {
      return;
    }

    element.style.height = "0px";
    element.style.height = `${element.scrollHeight}px`;
  };

  useEffect(() => {
    if (isEditing) {
      resizeTitle();
    }
  }, [isEditing]);

  const disableEditing = () => {
    setIsEditing(false);
  };

  const { execute, isLoading } = useAction(updateList, {
    onSuccess: () => {
      disableEditing();
      rollbackRef.current = null;
    },
    onError: (error) => {
      if (rollbackRef.current) {
        boardState.resetToSnapshot(rollbackRef.current);
      }
      toast.error(error);
      rollbackRef.current = null;
    }
  });

  const handleSubmit = (formData: FormData) => {
    const title = formData.get("title") as string;
    const trimmedTitle = title.trim();
    const id = formData.get("id") as string;
    const boardId = formData.get("boardId") as string;

    if (!trimmedTitle) {
      return disableEditing();
    }

    if (trimmedTitle === data.title) {
      return disableEditing();
    }

    const snapshot = boardState.getSnapshot();
    rollbackRef.current = snapshot;
    boardState.patchList(id, { title: trimmedTitle });

    execute({
      title: trimmedTitle,
      id,
      boardId,
    });
  }

  const onBlur = () => {
    formRef.current?.requestSubmit();
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      formRef.current?.requestSubmit();
    }
  };

  const onTitleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      formRef.current?.requestSubmit();
    }
  };

  const handleTitlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    pointerDownRef.current = {
      x: event.clientX,
      y: event.clientY,
      time: window.performance.now(),
    };
  };

  const handleTitlePointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    const pointerDown = pointerDownRef.current;
    pointerDownRef.current = null;

    if (!pointerDown) {
      return;
    }

    const moved = Math.hypot(
      event.clientX - pointerDown.x,
      event.clientY - pointerDown.y,
    );
    const elapsed = window.performance.now() - pointerDown.time;

    if (moved <= 4 && elapsed < 250) {
      if (canEdit) {
        enableEditing();
      }
    }
  };

  useEventListener("keydown", onKeyDown);

  return (
    <div
      {...(!isEditing && canEdit ? dragHandleProps : {})}
      className={`${!isEditing && canEdit ? "cursor-pointer" : ""} pt-3 px-3 pb-1 text-sm font-semibold flex justify-between items-center gap-x-1`}
    >
      {isEditing && (
        <div {...dragHandleProps} style={{ display: "none" }} />
      )}
      {isEditing ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit(new FormData(e.currentTarget));
          }}
          ref={formRef}
          onMouseDown={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
          onTouchStart={(event) => event.stopPropagation()}
          className="flex-1"
        >
          <input hidden id="id" name="id" value={data.id} readOnly />
          <input hidden id="boardId" name="boardId" value={data.boardId} readOnly />
          <textarea
            ref={titleRef}
            onBlur={onBlur}
            id="title"
            name="title"
            disabled={isLoading}
            placeholder="Nhập tên danh sách…"
            defaultValue={data.title}
            rows={1}
            onInput={resizeTitle}
            onKeyDown={onTitleKeyDown}
            className="min-h-8 w-full resize-none overflow-hidden whitespace-pre-wrap break-words rounded-md border border-transparent bg-transparent px-2 py-1 text-base font-bold leading-snug outline-none transition hover:border-input focus:border-violet-400 focus:bg-white focus:ring-1 focus:ring-violet-200"
          />
          <button type="submit" hidden />
        </form>
      ) : (
        <div className="flex-1 min-w-0">
          <button
            type="button"
            onPointerDown={handleTitlePointerDown}
            onPointerUp={handleTitlePointerUp}
            onPointerCancel={() => {
              pointerDownRef.current = null;
            }}
            className="flex min-h-8 w-fit max-w-full cursor-pointer items-start rounded-md px-2 py-1 text-left text-base font-bold text-neutral-800 transition-colors hover:bg-neutral-200/60"
          >
            <span className="whitespace-normal break-words">{data.title}</span>
          </button>
        </div>
      )}
      <div className="flex items-center gap-x-1">
        <Hint description={`${data.cards.length} thẻ`} side="top" sideOffset={6}>
          <span className="inline-flex h-7 min-w-7 cursor-default items-center justify-center rounded-md bg-white/80 px-2 text-xs font-semibold text-neutral-500 shadow-sm border border-neutral-200">
            {data.cards.length}
          </span>
        </Hint>
        {canEdit && (
          <ListOptions
            onAddCard={onAddCard}
            onRename={enableEditing}
            data={data}
            open={optionsOpen}
            onOpenChange={onOptionsOpenChange}
          />
        )}
      </div>
    </div>
  );
};
