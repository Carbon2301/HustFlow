"use client";

import { toast } from "sonner";
import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { CardWithList } from "@/types";
import { useAction } from "@/hooks/use-action";
import { updateCard } from "@/actions/update-card";
import { Skeleton } from "@/components/ui/skeleton";
import { useBoardCalendarInvalidation } from "@/hooks/use-board-calendar-invalidation";
import { Hint } from "@/components/hint";
import { BlockedCompletionDialog } from "./metadata/blocked-completion-dialog";
import { cn } from "@/lib/utils";

import { patchBoardCardPreview, patchCardQueryData } from "./card-cache-utils";

interface HeaderProps {
  data: CardWithList;
  canEdit?: boolean;
}

export const Header = ({
  data,
  canEdit = true,
}: HeaderProps) => {
  const queryClient = useQueryClient();
  const boardId = data.list.boardId;
  const invalidateBoardCalendar = useBoardCalendarInvalidation(boardId);

  const unresolvedBlockers = data.blockedByDependencies.filter(
    (dependency) => !dependency.blockerCard.isCompleted
  );

  const [blockedCompletionOpen, setBlockedCompletionOpen] = useState(false);
  const [animateComplete, setAnimateComplete] = useState(false);

  useEffect(() => {
    if (data.isCompleted) {
      setAnimateComplete(true);
      const timer = setTimeout(() => setAnimateComplete(false), 600);
      return () => clearTimeout(timer);
    }
  }, [data.isCompleted]);

  const { execute: executeUpdateCard, isLoading: isLoadingUpdate } = useAction(updateCard, {
    onSuccess: (updatedCard) => {
      patchCardQueryData(queryClient, updatedCard.id, {
        isCompleted: updatedCard.isCompleted,
      });
      patchBoardCardPreview(boardId, updatedCard.id, {
        isCompleted: updatedCard.isCompleted,
      });
      queryClient.invalidateQueries({
        queryKey: ["card-logs", updatedCard.id],
      });
      invalidateBoardCalendar();

      if (updatedCard.isCompleted !== data.isCompleted) {
        const relatedDependencyCardIds = [
          ...data.blockedByDependencies.map((dependency) => dependency.blockerCardId),
          ...data.blockingDependencies.map((dependency) => dependency.blockedCardId),
        ];

        Array.from(new Set(relatedDependencyCardIds)).forEach((cardId) => {
          queryClient.invalidateQueries({
            queryKey: ["card", cardId],
          });
        });
      }
    },
    onError: (error) => {
      toast.error(error);
    },
  });

  const onToggleComplete = () => {
    if (!canEdit || isLoadingUpdate) {
      return;
    }

    const nextChecked = !data.isCompleted;

    if (nextChecked && unresolvedBlockers.length > 0) {
      setBlockedCompletionOpen(true);
      return;
    }

    updateCompletion(nextChecked);
  };

  const updateCompletion = (checked: boolean) => {
    executeUpdateCard({
      id: data.id,
      boardId,
      isCompleted: checked,
    });
  };

  const onConfirmBlockedCompletion = () => {
    updateCompletion(true);
    setBlockedCompletionOpen(false);
  };

  const { execute } = useAction(updateCard, {
    onSuccess: (data) => {
      patchCardQueryData(queryClient, data.id, {
        title: data.title,
      });
      patchBoardCardPreview(boardId, data.id, {
        title: data.title,
      });

      queryClient.invalidateQueries({
        queryKey: ["card-logs", data.id]
      });

      invalidateBoardCalendar();
      setTitle(data.title);
    },
    onError: (error) => {
      toast.error(error);
    }
  });

  const titleRef = useRef<HTMLTextAreaElement>(null);

  const [title, setTitle] = useState(data.title);

  const resizeTitle = () => {
    const element = titleRef.current;

    if (!element) {
      return;
    }

    element.style.height = "0px";
    element.style.height = `${element.scrollHeight}px`;
  };

  useEffect(() => {
    resizeTitle();
  }, [title]);

  const onBlur = () => {
    if (!canEdit) {
      return;
    }

    titleRef.current?.form?.requestSubmit();
  };

  const onSubmit = (formData: FormData) => {
    const title = formData.get("title") as string;
    const trimmedTitle = title.trim();

    if (!canEdit) {
      return;
    }

    if (!trimmedTitle) {
      if (titleRef.current) {
        titleRef.current.value = data.title;
      }
      setTitle(data.title);
      requestAnimationFrame(resizeTitle);
      return;
    }

    if (trimmedTitle === data.title) {
      if (titleRef.current) {
        titleRef.current.value = data.title;
      }
      requestAnimationFrame(resizeTitle);
      return;
    }

    execute({
      title: trimmedTitle,
      boardId,
      id: data.id,
    });
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      titleRef.current?.form?.requestSubmit();
    }
  };

  return (
    <div className="flex items-start gap-x-4 mb-3 w-full">
      <style>{`
        @keyframes blinkBlink {
          0% {
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
          }
          50% {
            transform: scale(1.15);
            box-shadow: 0 0 0 8px rgba(16, 185, 129, 0);
          }
          100% {
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(16, 185, 129, 0);
          }
        }
        .animate-complete-pop {
          animation: blinkBlink 0.6s ease-out forwards;
        }
      `}</style>

      {canEdit && (
        <BlockedCompletionDialog
          open={blockedCompletionOpen}
          onOpenChange={setBlockedCompletionOpen}
          blockers={unresolvedBlockers}
          isLoading={isLoadingUpdate}
          onConfirm={onConfirmBlockedCompletion}
        />
      )}

      <Hint description={data.isCompleted ? "Đánh dấu chưa hoàn thành" : "Đánh dấu hoàn thành"} side="bottom">
        <button
          onClick={onToggleComplete}
          disabled={!canEdit || isLoadingUpdate}
          className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 transition-all duration-200 border-2 shadow-xs",
            data.isCompleted 
              ? "bg-emerald-500 border-emerald-500 text-white" 
              : "bg-white border-neutral-300 text-transparent",
            canEdit && !data.isCompleted && "hover:border-emerald-500 hover:text-emerald-500/40",
            canEdit && "cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 hover:scale-105",
            !canEdit && "opacity-80 cursor-default",
            animateComplete && "animate-complete-pop"
          )}
          aria-label={data.isCompleted ? "Đánh dấu chưa hoàn thành" : "Đánh dấu hoàn thành"}
        >
          <Check className={cn(
            "h-5 w-5 transition-transform duration-200",
            data.isCompleted ? "stroke-[3] scale-100" : "stroke-[2] scale-90 hover:scale-100"
          )} />
        </button>
      </Hint>
      <div className="w-full min-w-0">
        <form onSubmit={(e) => {
          e.preventDefault();
          onSubmit(new FormData(e.currentTarget));
        }}>
          <textarea
            ref={titleRef}
            onBlur={onBlur}
            onInput={resizeTitle}
            onKeyDown={onKeyDown}
            id="title"
            name="title"
            defaultValue={title}
            readOnly={!canEdit}
            rows={1}
            className="relative -left-2 mb-0.5 min-h-10 w-[calc(100%+0.5rem)] resize-none overflow-hidden whitespace-pre-wrap break-words rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-2xl font-bold leading-tight text-neutral-800 outline-none transition focus-visible:border-neutral-300 focus-visible:bg-white focus-visible:ring-1 focus-visible:ring-violet-200 read-only:cursor-default read-only:focus-visible:border-transparent read-only:focus-visible:bg-transparent read-only:focus-visible:ring-0 md:text-2xl"
          />
        </form>
        <p className="text-sm text-neutral-400 pl-0.5">
          trong danh sách{" "}
          <span className="inline break-words align-bottom font-semibold text-neutral-600">
            {data.list.title}
          </span>
        </p>
      </div>
    </div>
  );
};

Header.Skeleton = function HeaderSkeleton() {
  return (
    <div className="flex items-start gap-x-4 mb-3">
      <Skeleton className="h-10 w-10 rounded-full bg-neutral-100" />
      <div className="space-y-2 flex-1">
        <Skeleton className="w-2/3 h-7 rounded-lg bg-neutral-100" />
        <Skeleton className="w-28 h-4 rounded bg-neutral-100" />
      </div>
    </div>
  );
};
