"use client";

import { toast } from "sonner";
import { AlignLeft, RefreshCw } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useEventListener, useOnClickOutside } from "usehooks-ts";

import { useAction } from "@/hooks/use-action";
import { updateCard } from "@/actions/update-card";
import { CardWithList } from "@/types";
import { Skeleton } from "@/components/ui/skeleton";
import { FormTextarea } from "@/components/form/form-textarea";
import { FormSubmit } from "@/components/form/form-submit";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverDescription,
} from "@/components/ui/popover";

import { patchBoardCardPreview, patchCardQueryData } from "./card-cache-utils";

interface DescriptionProps {
  data: CardWithList;
  canEdit?: boolean;
  getDescriptionBaseUpdatedAt: () => string | null;
  onDescriptionBaseUpdatedAtChange: (value: string) => void;
}

const DESCRIPTION_CONFLICT_ERROR_CODE = "DESCRIPTION_CONFLICT";
const DESCRIPTION_CONFLICT_MESSAGE =
  "Dữ liệu đã được cập nhật bởi một thành viên khác. Vui lòng reload thẻ để xem bản mới nhất.";

const toTimestampString = (value: Date | string | null | undefined) => {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);

  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

export const Description = ({
  data,
  canEdit = true,
  getDescriptionBaseUpdatedAt,
  onDescriptionBaseUpdatedAtChange,
}: DescriptionProps) => {
  const queryClient = useQueryClient();

  const [isEditing, setIsEditing] = useState(false);
  const [isConflictOpen, setIsConflictOpen] = useState(false);

  const formRef = useRef<HTMLFormElement>(null!);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isEditing) {
      const nextTimestamp = toTimestampString(data.descriptionUpdatedAt);
      if (nextTimestamp && nextTimestamp !== getDescriptionBaseUpdatedAt()) {
        onDescriptionBaseUpdatedAtChange(nextTimestamp);
      }
    }
  }, [data.descriptionUpdatedAt, isEditing, getDescriptionBaseUpdatedAt, onDescriptionBaseUpdatedAtChange]);

  const descriptionRequestRef = useRef<{
    previous: string | null;
  } | null>(null);

  const enableEditing = () => {
    if (!canEdit) {
      return;
    }

    setIsConflictOpen(false);
    setIsEditing(true);
    setTimeout(() => {
      textareaRef.current?.focus();
    });
  };

  const disableEditing = () => {
    setIsEditing(false);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      disableEditing();
    }
  };

  useEventListener("keydown", onKeyDown);
  useOnClickOutside(formRef, (event) => {
    const target = event.target as HTMLElement;
    if (target.closest(".description-conflict-popover")) {
      return;
    }
    disableEditing();
  });

  const { execute, fieldErrors, isLoading } = useAction(updateCard, {
    onSuccess: (updatedCard) => {
      const nextDescriptionUpdatedAt = toTimestampString(
        updatedCard.descriptionUpdatedAt,
      );

      descriptionRequestRef.current = null;
      disableEditing();
      patchCardQueryData(queryClient, updatedCard.id, {
        description: updatedCard.description,
        descriptionUpdatedAt: updatedCard.descriptionUpdatedAt,
      });
      patchBoardCardPreview(data.list.boardId, updatedCard.id, {
        description: updatedCard.description,
        descriptionUpdatedAt: updatedCard.descriptionUpdatedAt,
      });

      if (nextDescriptionUpdatedAt) {
        onDescriptionBaseUpdatedAtChange(nextDescriptionUpdatedAt);
      }

      queryClient.invalidateQueries({
        queryKey: ["card-logs", updatedCard.id],
      });
    },
    onError: (error, errorCode) => {
      const request = descriptionRequestRef.current;
      if (request) {
        patchCardQueryData(queryClient, data.id, {
          description: request.previous,
        });
        patchBoardCardPreview(data.list.boardId, data.id, {
          description: request.previous,
        });
        descriptionRequestRef.current = null;
      }

      if (errorCode === DESCRIPTION_CONFLICT_ERROR_CODE) {
        setIsConflictOpen(true);
        return;
      }

      toast.error(error);
    },
  });

  const reloadCard = async () => {
    setIsConflictOpen(false);
    disableEditing();
    await queryClient.invalidateQueries({ queryKey: ["card", data.id] });

    const latestCard = queryClient.getQueryData<{
      descriptionUpdatedAt?: Date | string;
    }>(["card", data.id]);
    const nextDescriptionUpdatedAt = toTimestampString(
      latestCard?.descriptionUpdatedAt,
    );

    if (nextDescriptionUpdatedAt) {
      onDescriptionBaseUpdatedAtChange(nextDescriptionUpdatedAt);
    }
  };

  const onSubmit = (formData: FormData) => {
    if (!canEdit || isLoading || descriptionRequestRef.current) {
      return;
    }

    const description = formData.get("description") as string;
    const boardId = data.list.boardId;
    const baseUpdatedAt =
      getDescriptionBaseUpdatedAt() ?? toTimestampString(data.descriptionUpdatedAt);

    if (description === data.description) {
      disableEditing();
      return;
    }

    if (!baseUpdatedAt) {
      toast.error("Không thể xác định mốc cập nhật mô tả.");
      return;
    }

    descriptionRequestRef.current = {
      previous: data.description,
    };

    patchCardQueryData(queryClient, data.id, {
      description,
    });
    patchBoardCardPreview(boardId, data.id, {
      description,
    });

    execute({
      id: data.id,
      description,
      descriptionBaseUpdatedAt: baseUpdatedAt,
      boardId,
    });
  };

  return (
    <div className="flex items-start gap-x-4 w-full">
      <div className="w-10 h-10 rounded-xl bg-neutral-100 flex items-center justify-center flex-shrink-0 mt-0.5">
        <AlignLeft className="h-5 w-5 text-neutral-500" />
      </div>
      <Popover open={isConflictOpen} onOpenChange={setIsConflictOpen}>
        <PopoverAnchor asChild>
          <div className="w-full min-w-0">
            <p className="font-semibold text-base text-neutral-800 mb-2.5">
              Mô tả
            </p>
            {isEditing ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  onSubmit(new FormData(e.currentTarget));
                }}
                ref={formRef}
                className="space-y-2.5"
              >
                <FormTextarea
                  id="description"
                  className="w-full text-base md:text-base leading-relaxed resize-none rounded-xl border-neutral-200 focus:border-violet-400 focus:ring-1 focus:ring-violet-200 shadow-sm min-h-[110px] px-3.5 py-2.5"
                  placeholder="Thêm mô tả chi tiết hơn..."
                  defaultValue={data.description || undefined}
                  errors={fieldErrors}
                  ref={textareaRef}
                  disabled={isLoading}
                />
                <div className="flex items-center gap-x-2">
                  <FormSubmit disabled={isLoading} className="h-9 text-sm bg-violet-600 hover:bg-violet-700 text-white rounded-lg px-5">
                    Lưu
                  </FormSubmit>
                  <Button
                    type="button"
                    onClick={disableEditing}
                    disabled={isLoading}
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
                role={canEdit ? "button" : undefined}
                className={`
                  min-h-[96px] text-base md:text-base leading-relaxed rounded-xl px-4 py-3 ${canEdit ? "cursor-pointer" : "cursor-default"}
                  transition-colors duration-150
                  ${
                    data.description
                      ? `text-neutral-700 bg-neutral-50 border border-neutral-200 ${canEdit ? "hover:bg-neutral-100" : ""}`
                      : `text-neutral-400 bg-neutral-50 border border-dashed border-neutral-200 ${canEdit ? "hover:bg-neutral-100 hover:border-neutral-300" : ""}`
                  }
                `}
              >
                {data.description ||
                  (canEdit ? "Nhập để thêm mô tả..." : "Chưa có mô tả.")}
              </div>
            )}
          </div>
        </PopoverAnchor>
        <PopoverContent align="start" side="bottom" className="w-80 description-conflict-popover">
          <PopoverDescription>{DESCRIPTION_CONFLICT_MESSAGE}</PopoverDescription>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={reloadCard}
            className="h-8 self-start rounded-lg text-xs font-semibold"
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Reload thẻ
          </Button>
        </PopoverContent>
      </Popover>
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
