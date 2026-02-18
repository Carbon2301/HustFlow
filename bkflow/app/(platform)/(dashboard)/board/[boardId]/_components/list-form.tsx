"use client";

import { toast } from "sonner";
import { Plus, X } from "lucide-react";
import { useParams } from "next/navigation";
import { useState, useRef } from "react";
import { useEventListener, useOnClickOutside } from "usehooks-ts";

import type { ListWithCards } from "@/types";
import { useAction } from "@/hooks/use-action";
import { Button } from "@/components/ui/button";
import { createList } from "@/actions/create-list";
import { FormInput } from "@/components/form/form-input";
import { FormSubmit } from "@/components/form/form-submit";

import { ListWrapper } from "./list-wrapper";
import { useBoardState } from "./list-container/board-state-context";

const createTemporaryId = () =>
  `temp-list-${globalThis.crypto?.randomUUID?.() ?? Date.now().toString()}`;

const normalizeList = (list: Omit<ListWithCards, "cards">): ListWithCards => ({
  ...list,
  cards: [],
});

export const ListForm = () => {
  const params = useParams();
  const boardState = useBoardState();

  const formRef = useRef<HTMLFormElement>(null!);
  const inputRef = useRef<HTMLInputElement>(null);
  const rollbackRef = useRef<ListWithCards[] | null>(null);
  const temporaryListIdRef = useRef<string | null>(null);

  const [isEditing, setIsEditing] = useState(false);

  const enableEditing = () => {
    setIsEditing(true);
    setTimeout(() => {
      inputRef.current?.focus();
    });
  };

  const disableEditing = () => {
    setIsEditing(false);
  };

  const { execute, fieldErrors, isLoading } = useAction(createList, {
    onSuccess: (data) => {
      const temporaryListId = temporaryListIdRef.current;

      if (temporaryListId) {
        boardState.replaceList(temporaryListId, normalizeList(data));
      }

      disableEditing();
      rollbackRef.current = null;
      temporaryListIdRef.current = null;
    },
    onError: (error) => {
      if (rollbackRef.current) {
        boardState.resetToSnapshot(rollbackRef.current);
      }

      toast.error(error);
      rollbackRef.current = null;
      temporaryListIdRef.current = null;
    },
    onComplete: () => {
      if (rollbackRef.current) {
        boardState.resetToSnapshot(rollbackRef.current);
      }

      rollbackRef.current = null;
      temporaryListIdRef.current = null;
    },
  });

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      disableEditing();
    };
  };

  useEventListener("keydown", onKeyDown);
  useOnClickOutside(formRef, disableEditing);

  const onSubmit = (formData: FormData) => {
    const title = formData.get("title") as string;
    const boardId = formData.get("boardId") as string;
    const snapshot = boardState.getSnapshot();
    const now = new Date();
    const temporaryListId = createTemporaryId();
    const order = snapshot.reduce((maxOrder, list) => Math.max(maxOrder, list.order), -1) + 1;

    rollbackRef.current = snapshot;
    temporaryListIdRef.current = temporaryListId;
    boardState.appendList({
      id: temporaryListId,
      title,
      boardId,
      order,
      archivedAt: null,
      createdAt: now,
      updatedAt: now,
      cards: [],
    });

    execute({
      title,
      boardId
    });
  }

  if (isEditing) {
    return (
      <ListWrapper>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(new FormData(e.currentTarget));
          }}
          ref={formRef}
          className="w-full p-3 rounded-xl bg-white space-y-3 shadow-md border border-neutral-100"
        >
          <FormInput
            ref={inputRef}
            errors={fieldErrors}
            id="title"
            disabled={isLoading}
            className="text-sm px-2 py-1.5 h-8 font-medium border-neutral-200 hover:border-violet-300 focus:border-violet-400 focus:ring-1 focus:ring-violet-200 transition rounded-lg"
            placeholder="Nhập tên danh sách…"
          />
          <input
            hidden
            defaultValue={params.boardId}
            name="boardId"
          />
          <div className="flex items-center gap-x-2">
            <FormSubmit disabled={isLoading} className="h-8 text-sm bg-violet-600 hover:bg-violet-700 text-white rounded-lg px-3">
              Thêm danh sách
            </FormSubmit>
            <Button
              onClick={disableEditing}
              disabled={isLoading}
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-neutral-500 hover:text-neutral-700 rounded-lg"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </form>
      </ListWrapper>
    );
  };

  return (
    <ListWrapper>
      <button
        onClick={enableEditing}
        className="w-full rounded-xl bg-white/10 hover:bg-white/20 border border-transparent transition-all duration-150 p-3 flex items-center gap-x-2 font-semibold text-sm text-white backdrop-blur-xs shadow-sm cursor-pointer"
      >
        <Plus className="h-4 w-4" />
        Thêm danh sách
      </button>
    </ListWrapper>
  );
};
