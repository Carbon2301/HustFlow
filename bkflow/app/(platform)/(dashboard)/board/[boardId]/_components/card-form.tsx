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
import { createCard } from "@/actions/create-card";
import { Button } from "@/components/ui/button";
import { FormSubmit } from "@/components/form/form-submit";
import { FormTextarea } from "@/components/form/form-textarea";

interface CardFormProps {
  listId: string;
  enableEditing: () => void;
  disableEditing: () => void;
  isEditing: boolean;
};

export const CardForm = forwardRef<HTMLTextAreaElement, CardFormProps>(({
  listId,
  enableEditing,
  disableEditing,
  isEditing,
}, ref) => {
  const params = useParams();
  const formRef = useRef<HTMLFormElement>(null!);

  const { execute, fieldErrors } = useAction(createCard, {
    onSuccess: (data) => {
      toast.success(`Đã tạo thẻ "${data.title}"`);
      formRef.current?.reset();
    },
    onError: (error) => {
      toast.error(error);
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
    const title = formData.get("title") as string;
    const listId = formData.get("listId") as string;
    const boardId = params.boardId as string;

    execute({ title, listId, boardId });
  };

  if (isEditing) {
    return (
      <form
        ref={formRef}
        action={onSubmit}
        className="mx-2 mt-1 mb-1 space-y-2"
      >
        <FormTextarea
          id="title"
          onKeyDown={onTextareakeyDown}
          ref={ref}
          placeholder="Nhập tiêu đề thẻ…"
          errors={fieldErrors}
          className="text-sm resize-none rounded-lg border-neutral-200 focus:border-violet-400 focus:ring-1 focus:ring-violet-200 shadow-sm"
        />
        <input
          hidden
          id="listId"
          name="listId"
          defaultValue={listId}
        />
        <div className="flex items-center gap-x-2">
          <FormSubmit className="h-8 text-sm bg-violet-600 hover:bg-violet-700 text-white rounded-lg px-3">
            Thêm thẻ
          </FormSubmit>
          <Button onClick={disableEditing} size="sm" variant="ghost" className="h-8 w-8 p-0 text-neutral-400 hover:text-neutral-600 rounded-lg">
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
