"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Archive, MoreHorizontal, Trash2, X } from "lucide-react";

import { deleteBoard } from "@/actions/boards/delete-board";
import { useAction } from "@/hooks/use-action";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ConfirmModal } from "@/components/modals/confirm-modal";

import { ArchivedItemsModal } from "./archived-items-modal";

interface BoardOptionsProps {
  id: string;
  canDelete?: boolean;
};

export const BoardOptions = ({ id, canDelete = false }: BoardOptionsProps) => {
  const [isArchivedModalOpen, setIsArchivedModalOpen] = useState(false);

  const { execute, isLoading } = useAction(deleteBoard, {
    onError: (error) => {
      toast.error(error);
    },
  });

  const onDelete = () => {
    execute({ id });
  };

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            aria-label="Mở thao tác bảng"
            className="h-8 w-8 p-0 text-white/80 hover:text-white hover:bg-white/20 rounded-lg cursor-pointer"
            variant="ghost"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          data-role="popover-content"
          className="px-0 pt-3 pb-2 w-52 shadow-lg rounded-xl border border-neutral-200"
          side="bottom"
          align="start"
        >
          <div className="text-xs font-semibold text-center text-neutral-400 uppercase tracking-wider pb-2 px-4">
            Thao tác bảng
          </div>
          <PopoverClose asChild>
            <Button
              className="h-7 w-7 p-0 absolute top-2 right-2 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-md"
              variant="ghost"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </PopoverClose>
          <PopoverClose asChild>
            <Button
              id="archived-items-trigger"
              variant="ghost"
              onClick={() => setIsArchivedModalOpen(true)}
              className="w-full h-9 px-4 justify-start font-normal text-sm text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900 gap-x-2 rounded-none"
            >
              <Archive className="h-4 w-4 text-neutral-400" />
              Mục đã lưu trữ
            </Button>
          </PopoverClose>
          {canDelete && (
            <ConfirmModal
              onConfirm={onDelete}
              title="Xóa bảng này?"
              description="Bạn có chắc chắn muốn xóa bảng này? Mọi danh sách và thẻ bên trong bảng sẽ bị xóa vĩnh viễn và không thể khôi phục."
              disabled={isLoading}
            >
              <Button
                variant="ghost"
                className="w-full h-9 px-4 justify-start font-normal text-sm text-red-500 hover:bg-red-50 hover:text-red-600 gap-x-2 rounded-none cursor-pointer"
              >
                <Trash2 className="h-4 w-4" />
                {isLoading ? "Đang xóa…" : "Xóa bảng này"}
              </Button>
            </ConfirmModal>
          )}
        </PopoverContent>
      </Popover>
      <ArchivedItemsModal
        boardId={id}
        open={isArchivedModalOpen}
        onOpenChange={setIsArchivedModalOpen}
      />
    </>
  );
};
