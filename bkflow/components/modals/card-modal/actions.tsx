"use client";

import { toast } from "sonner";
import { Copy, Trash2 } from "lucide-react";
import { useParams } from "next/navigation";

import { CardWithList } from "@/types";
import { useAction } from "@/hooks/use-action";
import { copyCard } from "@/actions/copy-card";
import { Button } from "@/components/ui/button";
import { deleteCard } from "@/actions/delete-card";
import { Skeleton } from "@/components/ui/skeleton";
import { useCardModal } from "@/hooks/use-card-modal";
import { useBoardCalendarInvalidation } from "@/hooks/use-board-calendar-invalidation";

interface ActionsProps {
  data: CardWithList;
};

export const Actions = ({
  data,
}: ActionsProps) => {
  const params = useParams();
  const boardId = params.boardId as string;
  const cardModal = useCardModal();
  const invalidateBoardCalendar = useBoardCalendarInvalidation(boardId);

  const {
    execute: executeCopyCard,
    isLoading: isLoadingCopy,
  } = useAction(copyCard, {
    onSuccess: (data) => {
      toast.success(`Đã sao chép thẻ "${data.title}"`);
      invalidateBoardCalendar();
      cardModal.onClose();
    },
    onError: (error) => {
      toast.error(error);
    },
  });

  const {
    execute: executeDeleteCard,
    isLoading: isLoadingDelete,
  } = useAction(deleteCard, {
    onSuccess: () => {
      invalidateBoardCalendar();
      cardModal.onClose();
    },
    onError: (error) => {
      toast.error(error);
    },
  });

  const onCopy = () => {
    executeCopyCard({
      id: data.id,
      boardId,
    });
  };

  const onDelete = () => {
    executeDeleteCard({
      id: data.id,
      boardId,
    });
  };

  return (
    <div className="space-y-2">
      <p className="text-[11px] font-bold text-neutral-400 uppercase tracking-widest mb-2.5 pl-1">
        Thao tác
      </p>
      <div className="flex flex-wrap gap-3">
        <Button
          onClick={onCopy}
          disabled={isLoadingCopy}
          variant="ghost"
          className="flex-1 min-w-[140px] md:max-w-[200px] justify-start h-10 text-sm font-semibold text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 rounded-xl gap-x-3 px-4 shadow-sm border border-neutral-100 transition-all"
          size="sm"
        >
          <Copy className="h-4.5 w-4.5 text-neutral-400" />
          {isLoadingCopy ? "Đang sao chép…" : "Sao chép thẻ"}
        </Button>
        <Button
          onClick={onDelete}
          disabled={isLoadingDelete}
          variant="ghost"
          className="flex-1 min-w-[140px] md:max-w-[200px] justify-start h-10 text-sm font-semibold text-red-600 hover:bg-red-50 hover:text-red-700 rounded-xl gap-x-3 px-4 shadow-sm border border-neutral-100 transition-all"
          size="sm"
        >
          <Trash2 className="h-4.5 w-4.5" />
          {isLoadingDelete ? "Đang xóa…" : "Xóa thẻ"}
        </Button>
      </div>
    </div>
  );
};

Actions.Skeleton = function ActionsSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="w-20 h-4 rounded bg-neutral-100 mb-1.5" />
      <div className="flex flex-wrap gap-3">
        <Skeleton className="flex-1 min-w-[140px] md:max-w-[200px] h-10 rounded-xl bg-neutral-100" />
        <Skeleton className="flex-1 min-w-[140px] md:max-w-[200px] h-10 rounded-xl bg-neutral-100" />
      </div>
    </div>
  );
};
