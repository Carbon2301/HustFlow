"use client";

import { toast } from "sonner";
import { List } from "@prisma/client";
import { useEventListener } from "usehooks-ts";
import { useState, useRef } from "react";

import { useAction } from "@/hooks/use-action";
import { updateList } from "@/actions/update-list";
import { FormInput } from "@/components/form/form-input";
import { ListOptions } from "./list-options";

interface ListHeaderProps {
  data: List;
  onAddCard: () => void;
};

export const ListHeader = ({
  data,
  onAddCard,
}: ListHeaderProps) => {
  const [title, setTitle] = useState(data.title);
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
      toast.success(`Renamed to "${data.title}"`);
      setTitle(data.title);
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
            placeholder="List name…"
            defaultValue={title}
            className="text-sm px-2 py-1 h-7 font-semibold border-transparent hover:border-input focus:border-violet-400 focus:ring-1 focus:ring-violet-200 transition rounded-md bg-transparent focus:bg-white truncate"
          />
          <button type="submit" hidden />
        </form>
      ) : (
        <div
          onClick={enableEditing}
          className="flex-1 text-sm px-2 py-1 h-7 font-semibold text-neutral-700 hover:bg-neutral-200/60 rounded-md transition-colors cursor-pointer truncate"
          title={title}
        >
          {title}
        </div>
      )}
      <ListOptions
        onAddCard={onAddCard}
        data={data}
      />
    </div>
  );
};