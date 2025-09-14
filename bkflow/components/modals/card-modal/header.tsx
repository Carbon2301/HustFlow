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

interface HeaderProps {
  data: CardWithList;
}

export const Header = ({
  data,
}: HeaderProps) => {
  const queryClient = useQueryClient();
  const params = useParams();

  const { execute } = useAction(updateCard, {
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ["card", data.id]
      });

      queryClient.invalidateQueries({
        queryKey: ["card-logs", data.id]
      });

      toast.success(`Renamed to "${data.title}"`);
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
    const boardId = params.boardId as string;

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
    <div className="flex items-start gap-x-3 mb-4 w-full">
      <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Layout className="h-4 w-4 text-violet-600" />
      </div>
      <div className="w-full min-w-0">
        <form action={onSubmit}>
          <FormInput
            ref={inputRef}
            onBlur={onBlur}
            id="title"
            defaultValue={title}
            className="font-semibold text-lg px-2 text-neutral-800 bg-transparent border-transparent relative -left-2 w-[calc(100%+0.5rem)] focus-visible:bg-white focus-visible:border-neutral-300 focus-visible:ring-1 focus-visible:ring-violet-200 rounded-lg mb-0.5 truncate transition"
          />
        </form>
        <p className="text-xs text-neutral-400 pl-0.5">
          in list{" "}
          <span className="font-medium text-neutral-600 hover:underline cursor-default">
            {data.list.title}
          </span>
        </p>
      </div>
    </div>
  );
};

Header.Skeleton = function HeaderSkeleton() {
  return (
    <div className="flex items-start gap-x-3 mb-4">
      <Skeleton className="h-8 w-8 rounded-lg bg-neutral-100" />
      <div className="space-y-2 flex-1">
        <Skeleton className="w-2/3 h-6 rounded-lg bg-neutral-100" />
        <Skeleton className="w-24 h-3.5 rounded bg-neutral-100" />
      </div>
    </div>
  );
};