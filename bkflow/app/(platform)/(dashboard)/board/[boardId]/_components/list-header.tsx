"use client";

import { toast } from "sonner";
import { useEventListener } from "usehooks-ts";
import { useState, useRef } from "react";

import { useAction } from "@/hooks/use-action";
import { updateList } from "@/actions/update-list";
import { FormInput } from "@/components/form/form-input";
import { Hint } from "@/components/hint";
import { ListWithCards } from "@/types";
import { ListOptions } from "./list-options";

interface ListHeaderProps {
  data: ListWithCards;
  onAddCard: () => void;
};

export const ListHeader = ({
  data,
  onAddCard,
}: ListHeaderProps) => {
  const [isEditing, setIsEditing] = useState(false);

  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const enableEditing = () => {
    setIsEditing(true);
    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  };

  const disableEditing = () => {
    setIsEditing(false);
  };

  const { execute } = useAction(updateList, {
    onSuccess: (data) => {
      toast.success(`Đã đổi tên thành "${data.title}"`);
      disableEditing();
    },
    onError: (error) => {
      toast.error(error);
    }
  });

  const handleSubmit = (formData: FormData) => {
    const title = formData.get("title") as string;
    const id = formData.get("id") as string;
    const boardId = formData.get("boardId") as string;

    if (title === data.title) {
      return disableEditing();
    }

    execute({
      title,
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

  useEventListener("keydown", onKeyDown);

  return (
    <div className="pt-3 px-3 pb-1 text-sm font-semibold flex justify-between items-center gap-x-1">
      {isEditing ? (
        <form
          ref={formRef}
          action={handleSubmit}
          className="flex-1"
        >
          <input hidden id="id" name="id" value={data.id} readOnly />
          <input hidden id="boardId" name="boardId" value={data.boardId} readOnly />
          <FormInput
            ref={inputRef}
            onBlur={onBlur}
            id="title"
            placeholder="Nhập tên danh sách…"
            defaultValue={data.title}
            className="text-base px-2 py-1 h-8 font-bold border-transparent hover:border-input focus:border-violet-400 focus:ring-1 focus:ring-violet-200 transition rounded-md bg-transparent focus:bg-white truncate"
          />
          <button type="submit" hidden />
        </form>
      ) : (
        <div className="flex-1 min-w-0">
          <button
            type="button"
            onClick={enableEditing}
            className="flex h-8 w-fit max-w-full items-center rounded-md px-2 py-1 text-left text-base font-bold text-neutral-800 transition-colors hover:bg-neutral-200/60"
          >
            <span className="truncate">{data.title}</span>
          </button>
        </div>
      )}
      <div className="flex items-center gap-x-1">
        <Hint description={`${data.cards.length} thẻ`} side="top" sideOffset={6}>
          <span className="inline-flex h-7 min-w-7 cursor-default items-center justify-center rounded-md bg-white/80 px-2 text-xs font-semibold text-neutral-500 shadow-sm border border-neutral-200">
            {data.cards.length}
          </span>
        </Hint>
        <ListOptions
          onAddCard={onAddCard}
          data={data}
        />
      </div>
    </div>
  );
};
