"use client";

import { toast } from "sonner";
import { AlignLeft } from "lucide-react";
import { useParams } from "next/navigation";
import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useEventListener, useOnClickOutside } from "usehooks-ts";

import { useAction } from "@/hooks/use-action";
import { updateCard } from "@/actions/update-card";
import { CardWithList } from "@/types";
import { Skeleton } from "@/components/ui/skeleton";
import { FormTextarea } from "@/components/form/form-textarea";
import { FormSubmit } from "@/components/form/form-submit";
import { Button } from "@/components/ui/button";

interface DescriptionProps {
  data: CardWithList;
};

export const Description = ({
  data
}: DescriptionProps) => {
  const params = useParams();
  const queryClient = useQueryClient();

  const [isEditing, setIsEditing] = useState(false);

  const formRef = useRef<HTMLFormElement>(null!);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const enableEditing = () => {
    setIsEditing(true);
    setTimeout(() => {
      textareaRef.current?.focus();
    });
  }

  const disableEditing = () => {
    setIsEditing(false);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      disableEditing();
    }
  };

  useEventListener("keydown", onKeyDown);
  useOnClickOutside(formRef, disableEditing);

  const { execute, fieldErrors } = useAction(updateCard, {
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ["card", data.id],
      });
      queryClient.invalidateQueries({
        queryKey: ["card-logs", data.id]
      });
      toast.success("Đã cập nhật mô tả");
      disableEditing();
    },
    onError: (error) => {
      toast.error(error);
    },
  });

  const onSubmit = (formData: FormData) => {
    const description = formData.get("description") as string;
    const boardId = params.boardId as string;

    execute({
      id: data.id,
      description,
      boardId,
    })
  }

  return (
    <div className="flex items-start gap-x-4 w-full">
      <div className="w-10 h-10 rounded-xl bg-neutral-100 flex items-center justify-center flex-shrink-0 mt-0.5">
        <AlignLeft className="h-5 w-5 text-neutral-500" />
      </div>
      <div className="w-full min-w-0">
        <p className="font-semibold text-base text-neutral-800 mb-2.5">
          Mô tả
        </p>
        {isEditing ? (
          <form
            action={onSubmit}
            ref={formRef}
            className="space-y-2.5"
          >
            <FormTextarea
              id="description"
              className="w-full text-base md:text-base leading-relaxed resize-none rounded-xl border-neutral-200 focus:border-violet-400 focus:ring-1 focus:ring-violet-200 shadow-sm min-h-[110px] px-3.5 py-2.5"
              placeholder="Thêm mô tả chi tiết hơn…"
              defaultValue={data.description || undefined}
              errors={fieldErrors}
              ref={textareaRef}
            />
            <div className="flex items-center gap-x-2">
              <FormSubmit className="h-9 text-sm bg-violet-600 hover:bg-violet-700 text-white rounded-lg px-5">
                Lưu
              </FormSubmit>
              <Button
                type="button"
                onClick={disableEditing}
                size="sm"
                variant="ghost"
                className="h-9 text-sm text-neutral-500 rounded-lg px-4"
              >
                Hủy
              </Button>
            </div>
          </form>
        ) : (
          <div
            onClick={enableEditing}
            role="button"
            className={`
              min-h-[96px] text-base md:text-base leading-relaxed rounded-xl px-4 py-3 cursor-pointer
              transition-colors duration-150
              ${data.description
                ? "text-neutral-700 bg-neutral-50 border border-neutral-200 hover:bg-neutral-100"
                : "text-neutral-400 bg-neutral-50 border border-dashed border-neutral-200 hover:bg-neutral-100 hover:border-neutral-300"
              }
            `}
          >
            {data.description || "Nhấp để thêm mô tả…"}
          </div>
        )}
      </div>
    </div>
  );
};

Description.Skeleton = function DescriptionSkeleton() {
  return (
    <div className="flex items-start gap-x-4 w-full">
      <Skeleton className="h-10 w-10 rounded-xl bg-neutral-100" />
      <div className="w-full space-y-3">
        <Skeleton className="w-28 h-5 rounded bg-neutral-100" />
        <Skeleton className="w-full h-24 rounded-xl bg-neutral-100" />
      </div>
    </div>
  );
};
