"use client";

import { toast } from "sonner";
import { useRef, useState } from "react";
import { Board } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { FormInput } from "@/components/form/form-input";
import { updateBoard } from "@/actions/update-board"; 
import { useAction } from "@/hooks/use-action";

interface BoardTitleFormProps {
  data: Board;
  canEdit: boolean;
};

export const BoardTitleForm = ({
  data,
  canEdit,
}: BoardTitleFormProps) => {
  const { execute } = useAction(updateBoard, {
    onSuccess: (data) => {
      toast.success(`Đã cập nhật bảng "${data.title}"!`);
      setTitle(data.title);
      disableEditing();
    },
    onError: (error) => {
      toast.error(error);
    }
  });

  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState(data.title);
  const [isEditing, setIsEditing] = useState(false);

  const enableEditing = () => {
    if (!canEdit) {
      return;
    }

    setIsEditing(true);
    setTimeout(() => {
     inputRef.current?.focus();
     inputRef.current?.select(); 
    })
  };

  const disableEditing = () => {
    setIsEditing(false);
  };

  const onSubmit = (formData: FormData) => {
    const title = formData.get("title") as string;
    
    execute({
      title,
      id: data.id,
    });
  };

  const onBlur = () => {
    formRef.current?.requestSubmit();
  };

  if (isEditing) {
    return (
      <form action={onSubmit} ref={formRef} className="flex items-center gap-x-2">
        <FormInput
          ref={inputRef}
          id="title"
          onBlur={onBlur}
          defaultValue={title}
          className="text-lg font-bold px-[7px] py-1 h-7 bg-transparent focus-visible:bg-white/20 focus-visible:ring-0 focus-visible:border-none border-none rounded-md transition text-white"
        />
      </form>
    )
  }
  
  return (
    <Button
      onClick={enableEditing}
      variant="transparent"
      disabled={!canEdit}
      className="font-bold text-lg h-auto w-auto p-1 px-2"
    >
      {title}
    </Button>
  );
};
