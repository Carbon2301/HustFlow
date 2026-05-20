"use client";

import { toast } from "sonner";
import { Plus, X } from "lucide-react";
import {
  forwardRef,
  useRef,
  KeyboardEventHandler,
} from "react";
import { useParams } from "next/navigation";
import { useOnClickOutside, useEventListener } from "usehooks-ts";

import { useAction } from "@/hooks/use-action";
import { createCard } from "@/actions/cards/create-card";
import { Button } from "@/components/ui/button";
import { FormSubmit } from "@/components/form/form-submit";
import { FormTextarea } from "@/components/form/form-textarea";
import type { CardWithAssignees, ListWithCards } from "@/types";

import { useBoardState } from "./board-state-context";

interface CardFormProps {
  listId: string;
  enableEditing: () => void;
  disableEditing: () => void;
  isEditing: boolean;
};

const createTemporaryId = () =>
  `temp-card-${globalThis.crypto?.randomUUID?.() ?? Date.now().toString()}`;

const createEmptyCardShape = ({
  id,
  title,
  listId,
  order,
  now,
}: {
  id: string;
  title: string;
  listId: string;
  order: number;
  now: Date;
}): CardWithAssignees => ({
  id,
  title,
  order,
  description: null,
  descriptionUpdatedAt: now,
  startDate: null,
  dueDate: null,
  isCompleted: false,
  reminder: null,
  reminderSetAt: null,
  archivedAt: null,
  archivedByListId: null,
  listId,
  createdAt: now,
  updatedAt: now,
  assignees: [],
  labels: [],
  checklists: [],
  checklistProgress: {
    total: 0,
    completed: 0,
  },
  _count: {
    comments: 0,
    attachments: 0,
  },
});

const normalizeCard = (
  card: Partial<CardWithAssignees>,
  fallback: CardWithAssignees,
): CardWithAssignees => ({
  ...fallback,
  ...card,
  assignees: card.assignees ?? fallback.assignees,
  labels: card.labels ?? fallback.labels,
  checklists: card.checklists ?? fallback.checklists,
  checklistProgress: card.checklistProgress ?? fallback.checklistProgress,
  _count: card._count ?? fallback._count,
});

export const CardForm = forwardRef<HTMLTextAreaElement, CardFormProps>(({
  listId,
  enableEditing,
  disableEditing,
  isEditing,
}, ref) => {
  const params = useParams();
  const boardState = useBoardState();
  const formRef = useRef<HTMLFormElement>(null!);
  const rollbackRef = useRef<ListWithCards[] | null>(null);
  const temporaryCardRef = useRef<CardWithAssignees | null>(null);

  const { execute, fieldErrors, isLoading } = useAction(createCard, {
    onSuccess: (data) => {
      const temporaryCard = temporaryCardRef.current;

      if (temporaryCard) {
        boardState.replaceCard(temporaryCard.id, normalizeCard(data, temporaryCard));
      }

      formRef.current?.reset();
      rollbackRef.current = null;
      temporaryCardRef.current = null;
    },
    onError: (error) => {
      if (rollbackRef.current) {
        boardState.resetToSnapshot(rollbackRef.current);
      }

      toast.error(error);
      rollbackRef.current = null;
      temporaryCardRef.current = null;
    },
  });

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      disableEditing();
    }
  };

  useOnClickOutside(formRef, disableEditing);
  useEventListener("keydown", onKeyDown);

  const onTextareakeyDown: KeyboardEventHandler<HTMLTextAreaElement> = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      formRef.current?.requestSubmit();
    }
  };

  const onSubmit = (formData: FormData) => {
    const title = (formData.get("title") as string) || "";
    const trimmedTitle = title.trim();
    const listId = formData.get("listId") as string;
    const boardId = params.boardId as string;

    if (trimmedTitle) {
      const snapshot = boardState.getSnapshot();
      const targetList = snapshot.find((list) => list.id === listId);
      const order = targetList
        ? targetList.cards.reduce((maxOrder, card) => Math.max(maxOrder, card.order), -1) + 1
        : 0;
      const temporaryCard = createEmptyCardShape({
        id: createTemporaryId(),
        title: trimmedTitle,
        listId,
        order,
        now: new Date(),
      });

      rollbackRef.current = snapshot;
      temporaryCardRef.current = temporaryCard;
      boardState.appendCard(listId, temporaryCard);
    }

    execute({ title: trimmedTitle, listId, boardId });
  };

  if (isEditing) {
    return (
      <form
        ref={formRef}
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(new FormData(e.currentTarget));
        }}
        className="mx-2 mt-1 mb-1 space-y-2"
      >
        <FormTextarea
          id="title"
          onKeyDown={onTextareakeyDown}
          ref={ref}
          placeholder="Nhập tiêu đề thẻ…"
          errors={fieldErrors}
          disabled={isLoading}
          className="text-sm resize-none rounded-lg border-neutral-200 focus:border-violet-400 focus:ring-1 focus:ring-violet-200 shadow-sm"
        />
        <input
          hidden
          id="listId"
          name="listId"
          defaultValue={listId}
        />
        <div className="flex items-center gap-x-2">
          <FormSubmit disabled={isLoading} className="h-8 text-sm bg-violet-600 hover:bg-violet-700 text-white rounded-lg px-3">
            Thêm thẻ
          </FormSubmit>
          <Button onClick={disableEditing} disabled={isLoading} size="sm" variant="ghost" className="h-8 w-8 p-0 text-neutral-400 hover:text-neutral-600 rounded-lg">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </form>
    )
  }

  return (
    <div className="px-2 pt-1">
      <Button
        onClick={enableEditing}
        className="h-8 px-2 w-full justify-start text-neutral-500 hover:text-neutral-700 text-sm hover:bg-neutral-200/50 rounded-lg !cursor-pointer"
        size="sm"
        variant="ghost"
      >
        <Plus className="h-3.5 w-3.5 mr-1.5" />
        Thêm thẻ
      </Button>
    </div>
  );
});

CardForm.displayName = "CardForm";
