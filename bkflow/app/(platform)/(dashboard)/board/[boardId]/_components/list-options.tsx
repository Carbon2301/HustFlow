"use client";

import { toast } from "sonner";
import { List } from "@prisma/client";
import { useRef } from "react";
import { useRouter } from "next/navigation";
import { Archive, MoreHorizontal, X, Plus, Copy } from "lucide-react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  PopoverClose
} from "@/components/ui/popover";
import { useAction } from "@/hooks/use-action";
import { Button } from "@/components/ui/button";
import { copyList } from "@/actions/copy-list";
import { archiveList } from "@/actions/archive-list";
import { archiveListCards } from "@/actions/archive-list-cards";
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
  const router = useRouter();

  const { execute: executeArchiveList, isLoading: isLoadingArchiveList } = useAction(archiveList, {
    onSuccess: (data) => {
      toast.success(`Đã lưu trữ danh sách "${data.title}"`);
      closeRef.current?.click();
      router.refresh();
    },
    onError: (error) => {
      toast.error(error)
    }
  });

  const { execute: executeArchiveListCards, isLoading: isLoadingArchiveListCards } = useAction(archiveListCards, {
    onSuccess: (data) => {
      toast.success(`Đã lưu trữ các thẻ trong danh sách "${data.title}"`);
      closeRef.current?.click();
      router.refresh();
    },
    onError: (error) => {
      toast.error(error)
    }
  });

  const { execute: executeCopy, isLoading: isLoadingCopy } = useAction(copyList, {
    onSuccess: (data) => {
      toast.success(`Đã sao chép danh sách "${data.title}"`);
      closeRef.current?.click();
      router.refresh();
    },
    onError: (error) => {
      toast.error(error)
    }
  });

  const isArchiving = isLoadingArchiveList || isLoadingArchiveListCards;

  const onArchiveList = (formData: FormData) => {
    const id = formData.get("id") as string;
    const boardId = formData.get("boardId") as string;

    executeArchiveList({ id, boardId });
  };

  const onArchiveListCards = (formData: FormData) => {
    const id = formData.get("id") as string;
    const boardId = formData.get("boardId") as string;

    executeArchiveListCards({ id, boardId });
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
          className="h-7 w-7 p-0 text-neutral-500 hover:text-neutral-700 hover:bg-neutral-200/60 rounded-md !cursor-pointer"
          variant="ghost"
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="px-0 pt-3 pb-2 w-60 shadow-lg rounded-xl border border-neutral-200" side="bottom" align="start">
        <div className="text-xs font-semibold text-center text-neutral-400 uppercase tracking-wider pb-2 px-4">
          Thao tác danh sách
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
          disabled={isArchiving || isLoadingCopy}
          className="w-full h-9 px-4 justify-start font-normal text-sm text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900 gap-x-2 rounded-none"
          variant="ghost"
        >
          <Plus className="h-4 w-4 text-neutral-400" />
          Thêm thẻ
        </Button>
        <form action={onCopy}>
          <input hidden name="id" id="id" value={data.id} readOnly />
          <input hidden name="boardId" id="boardId" value={data.boardId} readOnly />
          <FormSubmit
            variant="ghost"
            disabled={isArchiving || isLoadingCopy}
            className="w-full h-9 px-4 justify-start font-normal text-sm text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900 gap-x-2 rounded-none"
          >
            <Copy className="h-4 w-4 text-neutral-400" />
            Sao chép danh sách
          </FormSubmit>
        </form>
        <Separator className="my-1" />
        <form action={onArchiveList}>
          <input hidden name="id" id="id" value={data.id} readOnly />
          <input hidden name="boardId" id="boardId" value={data.boardId} readOnly />
          <FormSubmit
            variant="ghost"
            disabled={isArchiving || isLoadingCopy}
            className="w-full min-h-9 px-4 justify-start font-normal text-sm text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900 gap-x-2 rounded-none"
          >
            <Archive className="h-4 w-4 text-neutral-400 shrink-0" />
            <span className="text-left whitespace-normal">
              {isLoadingArchiveList ? "Đang lưu trữ…" : "Lưu trữ danh sách này"}
            </span>
          </FormSubmit>
        </form>
        <form action={onArchiveListCards}>
          <input hidden name="id" id="id" value={data.id} readOnly />
          <input hidden name="boardId" id="boardId" value={data.boardId} readOnly />
          <FormSubmit
            variant="ghost"
            disabled={isArchiving || isLoadingCopy}
            className="w-full min-h-9 px-4 justify-start font-normal text-sm text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900 gap-x-2 rounded-none"
          >
            <Archive className="h-4 w-4 text-neutral-400 shrink-0" />
            <span className="text-left whitespace-normal">
              {isLoadingArchiveListCards ? "Đang lưu trữ…" : "Lưu trữ tất cả thẻ trong danh sách này"}
            </span>
          </FormSubmit>
        </form>
      </PopoverContent>
    </Popover>
  );
};
