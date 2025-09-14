"use client";

import { toast } from "sonner";
import { MoreHorizontal, Trash2, X } from "lucide-react";

import { deleteBoard } from "@/actions/delete-board";
import { useAction } from "@/hooks/use-action";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface BoardOptionsProps {
  id: string;
};

export const BoardOptions = ({ id }: BoardOptionsProps) => {
  const { execute, isLoading } = useAction(deleteBoard, {
    onError: (error) => {
      toast.error(error);
    }
  });

  const onDelete = () => {
    execute({ id });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          className="h-8 w-8 p-0 text-white/80 hover:text-white hover:bg-white/20 rounded-lg"
          variant="ghost"
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="px-0 pt-3 pb-2 w-52 shadow-lg rounded-xl border border-neutral-200"
        side="bottom"
        align="start"
      >
        <div className="text-xs font-semibold text-center text-neutral-400 uppercase tracking-wider pb-2 px-4">
          Board actions
        </div>
        <PopoverClose asChild>
          <Button
            className="h-7 w-7 p-0 absolute top-2 right-2 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-md"
            variant="ghost"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </PopoverClose>
        <Button
          variant="ghost"
          onClick={onDelete}
          disabled={isLoading}
          className="w-full h-9 px-4 justify-start font-normal text-sm text-red-500 hover:bg-red-50 hover:text-red-600 gap-x-2 rounded-none"
        >
          <Trash2 className="h-4 w-4" />
          {isLoading ? "Deleting…" : "Delete this board"}
        </Button>
      </PopoverContent>
    </Popover>
  );
};