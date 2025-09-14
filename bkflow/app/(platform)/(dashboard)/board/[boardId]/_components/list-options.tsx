"use client";

import { toast } from "sonner";
import { List } from "@prisma/client";
import { useRef } from "react";
import { MoreHorizontal, X, Plus, Copy, Trash2 } from "lucide-react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  PopoverClose
} from "@/components/ui/popover";
import { useAction } from "@/hooks/use-action";
import { Button } from "@/components/ui/button";
import { copyList } from "@/actions/copy-list";
import { deleteList } from "@/actions/delete-list";
import { FormSubmit } from "@/components/form/form-submit";
import { Separator } from "@/components/ui/separator";

interface ListOptionsProps {
  data: List;
  onAddCard: () => void;
};

export const ListOptions = ({
  data,
  onAddCard,
}: ListOptionsProps) => {
  const closeRef = useRef<HTMLButtonElement>(null);

  const { execute: executeDelete } = useAction(deleteList, {
    onSuccess: (data) => {
      toast.success(`List "${data.title}" deleted`);
      closeRef.current?.click();
    },
    onError: (error) => {
      toast.error(error)
    }
  });

  const { execute: executeCopy } = useAction(copyList, {
    onSuccess: (data) => {
      toast.success(`List "${data.title}" copied`);
      closeRef.current?.click();
    },
    onError: (error) => {
      toast.error(error)
    }
  });

  const onDelete = (formData: FormData) => {
    const id = formData.get("id") as string;
    const boardId = formData.get("boardId") as string;

    executeDelete({ id, boardId });
  };

  const onCopy = (formData: FormData) => {
    const id = formData.get("id") as string;
    const boardId = formData.get("boardId") as string;

    executeCopy({ id, boardId });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          className="h-7 w-7 p-0 text-neutral-500 hover:text-neutral-700 hover:bg-neutral-200/60 rounded-md"
          variant="ghost"
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="px-0 pt-3 pb-2 w-52 shadow-lg rounded-xl border border-neutral-200" side="bottom" align="start">
        <div className="text-xs font-semibold text-center text-neutral-400 uppercase tracking-wider pb-2 px-4">
          List actions
        </div>
        <PopoverClose ref={closeRef} asChild>
          <Button
            className="h-7 w-7 p-0 absolute top-2 right-2 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-md"
            variant="ghost"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </PopoverClose>
        <Button
          onClick={onAddCard}
          className="w-full h-9 px-4 justify-start font-normal text-sm text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900 gap-x-2 rounded-none"
          variant="ghost"
        >
          <Plus className="h-4 w-4 text-neutral-400" />
          Add card
        </Button>
        <form action={onCopy}>
          <input hidden name="id" id="id" value={data.id} readOnly />
          <input hidden name="boardId" id="boardId" value={data.boardId} readOnly />
          <FormSubmit
            variant="ghost"
            className="w-full h-9 px-4 justify-start font-normal text-sm text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900 gap-x-2 rounded-none"
          >
            <Copy className="h-4 w-4 text-neutral-400" />
            Copy list
          </FormSubmit>
        </form>
        <Separator className="my-1" />
        <form action={onDelete}>
          <input hidden name="id" id="id" value={data.id} readOnly />
          <input hidden name="boardId" id="boardId" value={data.boardId} readOnly />
          <FormSubmit
            variant="ghost"
            className="w-full h-9 px-4 justify-start font-normal text-sm text-red-500 hover:bg-red-50 hover:text-red-600 gap-x-2 rounded-none"
          >
            <Trash2 className="h-4 w-4" />
            Delete list
          </FormSubmit>
        </form>
      </PopoverContent>
    </Popover>
  );
};