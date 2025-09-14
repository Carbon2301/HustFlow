"use client";

import { toast } from "sonner";
import { Plus, X } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useState, useRef } from "react";
import { useEventListener, useOnClickOutside } from "usehooks-ts";

import { useAction } from "@/hooks/use-action";
import { Button } from "@/components/ui/button";
import { createList } from "@/actions/create-list";
import { FormInput } from "@/components/form/form-input";
import { FormSubmit } from "@/components/form/form-submit";

import { ListWrapper } from "./list-wrapper";

export const ListForm = () => {
  const router = useRouter();
  const params = useParams();

  const formRef = useRef<HTMLFormElement>(null!);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const { execute, fieldErrors } = useAction(createList, {
    onSuccess: (data) => {
      toast.success(`List "${data.title}" created`);
      disableEditing();
      router.refresh();
    },
    onError: (error) => {
      toast.error(error);
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

    execute({
      title,
      boardId
    });
  }

  if (isEditing) {
    return (
      <ListWrapper>
        <form
          action={onSubmit}
          ref={formRef}
          className="w-full p-3 rounded-xl bg-white space-y-3 shadow-md border border-neutral-100"
        >
          <FormInput
            ref={inputRef}
            errors={fieldErrors}
            id="title"
            className="text-sm px-2 py-1.5 h-8 font-medium border-neutral-200 hover:border-violet-300 focus:border-violet-400 focus:ring-1 focus:ring-violet-200 transition rounded-lg"
            placeholder="List name…"
          />
          <input
            hidden
            defaultValue={params.boardId}
            name="boardId"
          />
          <div className="flex items-center gap-x-2">
            <FormSubmit className="h-8 text-sm bg-violet-600 hover:bg-violet-700 text-white rounded-lg px-3">
              Add list
            </FormSubmit>
            <Button
              onClick={disableEditing}
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
        className="w-full rounded-xl bg-white/80 hover:bg-white/95 border border-transparent hover:border-white/60 transition-all duration-150 p-3 flex items-center gap-x-2 font-medium text-sm text-white/90 hover:text-white backdrop-blur-sm"
      >
        <Plus className="h-4 w-4" />
        Add a list
      </button>
    </ListWrapper>
  );
};
