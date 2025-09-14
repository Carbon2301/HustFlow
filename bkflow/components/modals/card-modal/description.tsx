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
      toast.success("Description updated");
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
    <div className="flex items-start gap-x-3 w-full">
      <div className="w-8 h-8 rounded-lg bg-neutral-100 flex items-center justify-center flex-shrink-0 mt-0.5">
        <AlignLeft className="h-4 w-4 text-neutral-500" />
      </div>
      <div className="w-full min-w-0">
        <p className="font-semibold text-sm text-neutral-700 mb-2">
          Description
        </p>
        {isEditing ? (
          <form
            action={onSubmit}
            ref={formRef}
            className="space-y-2"
          >
            <FormTextarea
              id="description"
              className="w-full text-sm resize-none rounded-lg border-neutral-200 focus:border-violet-400 focus:ring-1 focus:ring-violet-200 shadow-sm min-h-[80px]"
              placeholder="Add a more detailed description…"
              defaultValue={data.description || undefined}
              errors={fieldErrors}
              ref={textareaRef}
            />
            <div className="flex items-center gap-x-2">
              <FormSubmit className="h-8 text-sm bg-violet-600 hover:bg-violet-700 text-white rounded-lg px-4">
                Save
              </FormSubmit>
              <Button
                type="button"
                onClick={disableEditing}
                size="sm"
                variant="ghost"
                className="h-8 text-sm text-neutral-500 rounded-lg"
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <div
            onClick={enableEditing}
            role="button"
            className={`
              min-h-[72px] text-sm rounded-lg px-3 py-2.5 cursor-pointer
              transition-colors duration-150
              ${data.description
                ? "text-neutral-700 bg-neutral-50 border border-neutral-200 hover:bg-neutral-100"
                : "text-neutral-400 bg-neutral-50 border border-dashed border-neutral-200 hover:bg-neutral-100 hover:border-neutral-300"
              }
            `}
          >
            {data.description || "Click to add a description…"}
          </div>
        )}
      </div>
    </div>
  );
};

Description.Skeleton = function DescriptionSkeleton() {
  return (
    <div className="flex items-start gap-x-3 w-full">
      <Skeleton className="h-8 w-8 rounded-lg bg-neutral-100" />
      <div className="w-full space-y-2">
        <Skeleton className="w-24 h-4 rounded bg-neutral-100" />
        <Skeleton className="w-full h-[72px] rounded-lg bg-neutral-100" />
      </div>
    </div>
  );
};
