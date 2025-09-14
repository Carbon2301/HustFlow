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

interface ActionsProps {
  data: CardWithList;
};

export const Actions = ({
  data,
}: ActionsProps) => {
  const params = useParams();
  const cardModal = useCardModal();

  const {
    execute: executeCopyCard,
    isLoading: isLoadingCopy,
  } = useAction(copyCard, {
    onSuccess: (data) => {
      toast.success(`Card "${data.title}" copied`);
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
    onSuccess: (data) => {
      toast.success(`Card "${data.title}" deleted`);
      cardModal.onClose();
    },
    onError: (error) => {
      toast.error(error);
    },
  });

  const onCopy = () => {
    const boardId = params.boardId as string;

    executeCopyCard({
      id: data.id,
      boardId,
    });
  };

  const onDelete = () => {
    const boardId = params.boardId as string;

    executeDeleteCard({
      id: data.id,
      boardId,
    });
  };

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
        Actions
      </p>
      <Button
        onClick={onCopy}
        disabled={isLoadingCopy}
        variant="ghost"
        className="w-full justify-start h-9 text-sm font-medium text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 rounded-lg gap-x-2 px-3"
        size="sm"
      >
        <Copy className="h-4 w-4 text-neutral-400" />
        {isLoadingCopy ? "Copying…" : "Copy card"}
      </Button>
      <Button
        onClick={onDelete}
        disabled={isLoadingDelete}
        variant="ghost"
        className="w-full justify-start h-9 text-sm font-medium text-red-500 hover:bg-red-50 hover:text-red-600 rounded-lg gap-x-2 px-3"
        size="sm"
      >
        <Trash2 className="h-4 w-4" />
        {isLoadingDelete ? "Deleting…" : "Delete card"}
      </Button>
    </div>
  );
};

Actions.Skeleton = function ActionsSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="w-20 h-3.5 rounded bg-neutral-100" />
      <Skeleton className="w-full h-9 rounded-lg bg-neutral-100" />
      <Skeleton className="w-full h-9 rounded-lg bg-neutral-100" />
    </div>
  );
};