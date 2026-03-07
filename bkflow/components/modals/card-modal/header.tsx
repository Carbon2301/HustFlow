"use client";

import { toast } from "sonner";
import { useEffect, useRef, useState } from "react";
import { Layout } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { CardWithList } from "@/types";
import { useAction } from "@/hooks/use-action";
import { updateCard } from "@/actions/update-card";
import { Skeleton } from "@/components/ui/skeleton";
import { useBoardCalendarInvalidation } from "@/hooks/use-board-calendar-invalidation";

import { patchBoardCardPreview, patchCardQueryData } from "./card-cache-utils";

interface HeaderProps {
  data: CardWithList;
}

export const Header = ({
  data,
}: HeaderProps) => {
  const queryClient = useQueryClient();
  const boardId = data.list.boardId;
  const invalidateBoardCalendar = useBoardCalendarInvalidation(boardId);

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
    titleRef.current?.form?.requestSubmit();
  };

  const onSubmit = (formData: FormData) => {
    const title = formData.get("title") as string;
    const trimmedTitle = title.trim();

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
      <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Layout className="h-5 w-5 text-violet-600" />
      </div>
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
            rows={1}
            className="relative -left-2 mb-0.5 min-h-10 w-[calc(100%+0.5rem)] resize-none overflow-hidden whitespace-pre-wrap break-words rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-2xl font-bold leading-tight text-neutral-800 outline-none transition focus-visible:border-neutral-300 focus-visible:bg-white focus-visible:ring-1 focus-visible:ring-violet-200 md:text-2xl"
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
      <Skeleton className="h-10 w-10 rounded-xl bg-neutral-100" />
      <div className="space-y-2 flex-1">
        <Skeleton className="w-2/3 h-7 rounded-lg bg-neutral-100" />
        <Skeleton className="w-28 h-4 rounded bg-neutral-100" />
      </div>
    </div>
  );
};
