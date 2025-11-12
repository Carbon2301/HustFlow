"use client";

import { toast } from "sonner";
import { useRef, useState } from "react";
import { Layout } from "lucide-react";
import { useParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";

import { CardWithList } from "@/types";
import { useAction } from "@/hooks/use-action";
import { updateCard } from "@/actions/update-card";
import { Skeleton } from "@/components/ui/skeleton";
import { FormInput } from "@/components/form/form-input";
import { useBoardCalendarInvalidation } from "@/hooks/use-board-calendar-invalidation";

interface HeaderProps {
  data: CardWithList;
}

export const Header = ({
  data,
}: HeaderProps) => {
  const queryClient = useQueryClient();
  const params = useParams();
  const boardId = params.boardId as string;
  const invalidateBoardCalendar = useBoardCalendarInvalidation(boardId);

  const { execute } = useAction(updateCard, {
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ["card", data.id]
      });

      queryClient.invalidateQueries({
        queryKey: ["card-logs", data.id]
      });

      toast.success(`Đã đổi tên thành "${data.title}"`);
      invalidateBoardCalendar();
      setTitle(data.title);
    },
    onError: (error) => {
      toast.error(error);
    }
  });

  const inputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState(data.title);

  const onBlur = () => {
    inputRef.current?.form?.requestSubmit();
  };

  const onSubmit = (formData: FormData) => {
    const title = formData.get("title") as string;

    if (title === data.title) {
      return;
    }

    execute({
      title,
      boardId,
      id: data.id,
    });
  }

  return (
    <div className="flex items-start gap-x-4 mb-3 w-full">
      <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Layout className="h-5 w-5 text-violet-600" />
      </div>
      <div className="w-full min-w-0">
        <form action={onSubmit}>
          <FormInput
            ref={inputRef}
            onBlur={onBlur}
            id="title"
            defaultValue={title}
            className="font-bold text-2xl md:text-2xl px-2 text-neutral-800 bg-transparent border-transparent relative -left-2 w-[calc(100%+0.5rem)] focus-visible:bg-white focus-visible:border-neutral-300 focus-visible:ring-1 focus-visible:ring-violet-200 rounded-lg mb-0.5 truncate transition h-10 py-1.5"
          />
        </form>
        <p className="text-sm text-neutral-400 pl-0.5">
          trong danh sách{" "}
          <span className="font-semibold text-neutral-600 hover:underline cursor-default">
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
