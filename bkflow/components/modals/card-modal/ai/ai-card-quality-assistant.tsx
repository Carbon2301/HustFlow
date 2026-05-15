"use client";

import { useMemo, useState } from "react";
import type { Checklist } from "@prisma/client";
import { useQueryClient } from "@tanstack/react-query";
import { CheckSquare, RefreshCw, Sparkles, X } from "lucide-react";
import { toast } from "sonner";

import { createAiChecklistItems } from "@/actions/create-ai-checklist-items";
import { generateAiCardQuality } from "@/actions/generate-ai-card-quality";
import { generateAiChecklist } from "@/actions/generate-ai-checklist";
import { updateCard } from "@/actions/update-card";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverDescription,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { useAction } from "@/hooks/use-action";
import { cn } from "@/lib/utils";

import { patchBoardCardPreview, patchCardQueryData } from "../card-cache-utils";

type QualityTask = "create_description" | "rewrite_description";
type AiTask = QualityTask | "suggest_checklist";

type ChecklistOption = Checklist & {
  items: {
    id: string;
    title: string;
  }[];
};

interface AiCardQualityAssistantProps {
  boardId: string;
  cardId: string;
  description: string | null;
  getDescriptionBaseUpdatedAt: () => string | null;
  onDescriptionBaseUpdatedAtChange: (value: string) => void;
  checklists: ChecklistOption[];
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

const taskLabels: Record<QualityTask, string> = {
  create_description: "Tạo mô tả từ tiêu đề",
  rewrite_description: "Viết lại mô tả",
};

const NEW_CHECKLIST_VALUE = "__new__";
const DEFAULT_CHECKLIST_TITLE = "Việc cần làm";

export const AiCardQualityAssistant = ({
  boardId,
  cardId,
  description,
  getDescriptionBaseUpdatedAt,
  onDescriptionBaseUpdatedAtChange,
  checklists,
}: AiCardQualityAssistantProps) => {
  const queryClient = useQueryClient();
  const [activeTask, setActiveTask] = useState<AiTask | null>(null);
  const [previewDescription, setPreviewDescription] = useState("");
  const [checklistSuggestions, setChecklistSuggestions] = useState<string[]>([]);
  const [isConflictOpen, setIsConflictOpen] = useState(false);
  const [generationBaseUpdatedAt, setGenerationBaseUpdatedAt] = useState<string | null>(null);
  const [selectedChecklistItems, setSelectedChecklistItems] = useState<Set<string>>(new Set());
  const [selectedChecklistId, setSelectedChecklistId] = useState(
    checklists[0]?.id ?? NEW_CHECKLIST_VALUE,
  );

  const hasDescription = !!description?.trim();
  const isDescriptionTask = activeTask === "create_description" || activeTask === "rewrite_description";
  const isChecklistTask = activeTask === "suggest_checklist";
  const selectedChecklistItemCount = useMemo(
    () => checklistSuggestions.filter((item) => selectedChecklistItems.has(item)).length,
    [checklistSuggestions, selectedChecklistItems],
  );
  const canSelectChecklist = checklists.length > 0;
  const fallbackChecklistId = checklists[0]?.id ?? NEW_CHECKLIST_VALUE;
  const selectedChecklistExists = checklists.some((checklist) => checklist.id === selectedChecklistId);
  const effectiveChecklistId = selectedChecklistId === NEW_CHECKLIST_VALUE || selectedChecklistExists
    ? selectedChecklistId
    : fallbackChecklistId;

  const invalidateCard = () => {
    queryClient.invalidateQueries({ queryKey: ["card", cardId] });
    queryClient.invalidateQueries({ queryKey: ["card-logs", cardId] });
  };

  const resetPreview = () => {
    setActiveTask(null);
    setPreviewDescription("");
    setChecklistSuggestions([]);
    setSelectedChecklistItems(new Set());
  };

  const { execute: executeGenerate, isLoading: isGenerating } = useAction(generateAiCardQuality, {
    onSuccess: (data) => {
      setActiveTask(data.task);

      if (data.description) {
        setPreviewDescription(data.description);
        toast.success("AI đã tạo bản nháp mô tả.");
        return;
      }
    },
    onError: (error) => toast.error(error),
  });

  const { execute: executeUpdateCard, isLoading: isUpdatingDescription } = useAction(updateCard, {
    onSuccess: (updatedCard) => {
      const nextDescriptionUpdatedAt = toTimestampString(
        updatedCard.descriptionUpdatedAt,
      );

      patchCardQueryData(queryClient, updatedCard.id, {
        description: updatedCard.description,
        descriptionUpdatedAt: updatedCard.descriptionUpdatedAt,
      });
      patchBoardCardPreview(boardId, updatedCard.id, {
        description: updatedCard.description,
        descriptionUpdatedAt: updatedCard.descriptionUpdatedAt,
      });
      if (nextDescriptionUpdatedAt) {
        onDescriptionBaseUpdatedAtChange(nextDescriptionUpdatedAt);
      }
      invalidateCard();
      resetPreview();
    },
    onError: (error, errorCode) => {
      if (errorCode === DESCRIPTION_CONFLICT_ERROR_CODE) {
        setIsConflictOpen(true);
        return;
      }

      toast.error(error);
    },
  });



  const { execute: executeGenerateChecklist, isLoading: isGeneratingChecklist } = useAction(generateAiChecklist, {
    onSuccess: (data) => {
      setActiveTask("suggest_checklist");
      setPreviewDescription("");
      setChecklistSuggestions(data.items);
      setSelectedChecklistItems(new Set(data.items));
      toast.success("AI đã gợi ý danh sách việc cần làm cho thẻ này.");
    },
    onError: (error) => toast.error(error),
  });

  const { execute: executeCreateChecklistItems, isLoading: isCreatingChecklistItems } = useAction(createAiChecklistItems, {
    onSuccess: (data) => {
      toast.success(`Đã thêm ${data.items.length} việc cần làm`);
      setActiveTask(null);
      setChecklistSuggestions([]);
      setSelectedChecklistItems(new Set());
      invalidateCard();
    },
    onError: (error) => {
      toast.error(error);
      invalidateCard();
    },
  });

  const handleGenerate = (task: QualityTask) => {
    setActiveTask(task);
    setChecklistSuggestions([]);
    setSelectedChecklistItems(new Set());

    const currentBase = getDescriptionBaseUpdatedAt();
    setGenerationBaseUpdatedAt(currentBase);

    executeGenerate({
      boardId,
      cardId,
      task,
    });
  };

  const handleGenerateChecklist = () => {
    setActiveTask("suggest_checklist");
    executeGenerateChecklist({
      boardId,
      cardId,
    });
  };

  const handleApplyDescription = () => {
    if (!previewDescription.trim()) {
      return;
    }

    const baseUpdatedAt = generationBaseUpdatedAt || getDescriptionBaseUpdatedAt();

    if (!baseUpdatedAt) {
      toast.error("Không thể xác định mốc cập nhật mô tả.");
      return;
    }

    executeUpdateCard({
      id: cardId,
      boardId,
      description: previewDescription,
      descriptionBaseUpdatedAt: baseUpdatedAt,
    });
  };

  const reloadCard = async () => {
    setIsConflictOpen(false);
    await queryClient.invalidateQueries({ queryKey: ["card", cardId] });

    const latestCard = queryClient.getQueryData<{
      descriptionUpdatedAt?: Date | string;
    }>(["card", cardId]);
    const nextDescriptionUpdatedAt = toTimestampString(
      latestCard?.descriptionUpdatedAt,
    );

    if (nextDescriptionUpdatedAt) {
      onDescriptionBaseUpdatedAtChange(nextDescriptionUpdatedAt);
    }
  };



  const handleToggleChecklistItem = (item: string) => {
    setSelectedChecklistItems((current) => {
      const next = new Set(current);

      if (next.has(item)) {
        next.delete(item);
      } else {
        next.add(item);
      }

      return next;
    });
  };

  const handleApplyChecklistItems = () => {
    const items = checklistSuggestions.filter((item) => selectedChecklistItems.has(item));

    if (items.length === 0) {
      return;
    }

    executeCreateChecklistItems({
      boardId,
      cardId,
      checklistId: effectiveChecklistId === NEW_CHECKLIST_VALUE
        ? undefined
        : effectiveChecklistId,
      checklistTitle: DEFAULT_CHECKLIST_TITLE,
      items,
    });
  };

  const isBusy = isGenerating || isUpdatingDescription || isGeneratingChecklist || isCreatingChecklistItems;

  return (
    <div className="flex items-start gap-x-4 w-full">
      <div className="w-10 h-10 rounded-xl bg-sky-50 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Sparkles className="h-5 w-5 text-sky-500" />
      </div>
      <div className="w-full min-w-0 rounded-xl border border-sky-100 bg-sky-50/40 p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-neutral-800">
              Cải thiện thẻ bằng AI
            </p>
            <p className="mt-0.5 text-xs text-neutral-500">
              Tạo bản nháp trước, chỉ áp dụng khi bạn xác nhận.
            </p>
          </div>
          {activeTask && (
            <button
              type="button"
              onClick={resetPreview}
              disabled={isBusy}
              className="inline-flex h-8 items-center rounded-lg px-2 text-xs font-semibold text-neutral-500 transition hover:bg-white hover:text-neutral-700 disabled:opacity-50"
            >
              <X className="mr-1 h-3.5 w-3.5" />
              Hủy
            </button>
          )}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {(Object.keys(taskLabels) as QualityTask[]).map((task) => {
            const disabled = isBusy || (task === "rewrite_description" && !hasDescription);

            return (
              <Button
                key={task}
                type="button"
                variant="outline"
                onClick={() => handleGenerate(task)}
                disabled={disabled}
                className={cn(
                  "h-8 rounded-lg border-sky-200 bg-white px-3 text-xs font-semibold text-sky-700 hover:bg-sky-50",
                  activeTask === task && "border-sky-300 bg-sky-50",
                )}
              >
                {isGenerating && activeTask === task ? (
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                )}
              {isGenerating && activeTask === task ? "Đang tạo..." : taskLabels[task]}
              </Button>
            );
          })}
          <Button
            type="button"
            variant="outline"
            onClick={handleGenerateChecklist}
            disabled={isBusy}
            className={cn(
              "h-8 rounded-lg border-sky-200 bg-white px-3 text-xs font-semibold text-sky-700 hover:bg-sky-50",
              activeTask === "suggest_checklist" && "border-sky-300 bg-sky-50",
            )}
          >
            {isGeneratingChecklist ? (
              <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckSquare className="mr-1.5 h-3.5 w-3.5" />
            )}
            {isGeneratingChecklist ? "Đang gợi ý..." : checklistSuggestions.length > 0 ? "Tạo lại" : "Gợi ý việc cần làm"}
          </Button>
        </div>

        {isDescriptionTask && previewDescription && (
          <div className="mt-3 space-y-3 rounded-lg border border-white/70 bg-white p-3 shadow-xs">
            <Textarea
              value={previewDescription}
              onChange={(event) => setPreviewDescription(event.target.value)}
              disabled={isBusy}
              className="min-h-[190px] resize-y rounded-lg border-neutral-200 text-sm leading-relaxed focus:border-sky-400 focus:ring-1 focus:ring-sky-200"
            />
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-neutral-100 pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => activeTask && handleGenerate(activeTask)}
                disabled={isBusy}
                className="h-8 rounded-lg px-3 text-xs font-semibold"
              >
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                Tạo lại
              </Button>
              <Popover open={isConflictOpen} onOpenChange={setIsConflictOpen}>
                <PopoverAnchor asChild>
                  <Button
                    type="button"
                    onClick={handleApplyDescription}
                    disabled={isBusy || !previewDescription.trim()}
                    className="h-8 rounded-lg bg-sky-600 px-3 text-xs font-semibold text-white hover:bg-sky-700"
                  >
                    {isUpdatingDescription ? "Đang áp dụng..." : "Áp dụng mô tả"}
                  </Button>
                </PopoverAnchor>
                <PopoverContent align="end" side="bottom" className="w-80">
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
          </div>
        )}



        {isChecklistTask && checklistSuggestions.length > 0 && (
          <div className="mt-3 space-y-3 rounded-lg border border-white/70 bg-white p-3 shadow-xs">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              {canSelectChecklist ? (
                <label className="flex min-w-0 flex-1 items-center gap-2 text-xs font-semibold text-neutral-600">
                  Thêm vào
                  <select
                    value={effectiveChecklistId}
                    onChange={(event) => setSelectedChecklistId(event.target.value)}
                    disabled={isBusy}
                    className="h-8 min-w-0 flex-1 rounded-lg border border-neutral-200 bg-white px-2 text-xs text-neutral-700 outline-none transition focus:border-sky-400 focus:ring-1 focus:ring-sky-200"
                  >
                    {checklists.map((checklist) => (
                      <option key={checklist.id} value={checklist.id}>
                        {checklist.title}
                      </option>
                    ))}
                    <option value={NEW_CHECKLIST_VALUE}>
                      Tạo danh sách mới: {DEFAULT_CHECKLIST_TITLE}
                    </option>
                  </select>
                </label>
              ) : (
                <p className="text-xs font-semibold text-neutral-600">
                  Sẽ tạo danh sách mới: {DEFAULT_CHECKLIST_TITLE}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              {checklistSuggestions.map((item) => (
                <label
                  key={item}
                  className={cn(
                    "flex cursor-pointer items-start gap-2 rounded-lg border border-neutral-100 px-3 py-2 text-sm text-neutral-700 transition hover:bg-neutral-50",
                    isBusy && "cursor-wait opacity-70",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={selectedChecklistItems.has(item)}
                    onChange={() => handleToggleChecklistItem(item)}
                    disabled={isBusy}
                    className="mt-1 h-4 w-4 rounded border-neutral-300 accent-sky-600"
                  />
                  <span className="leading-relaxed">{item}</span>
                </label>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100 pt-3">
              <span className="text-xs font-medium text-neutral-500">
                Đã chọn {selectedChecklistItemCount}/{checklistSuggestions.length} việc cần làm
              </span>
              <Button
                type="button"
                onClick={handleApplyChecklistItems}
                disabled={isBusy || selectedChecklistItemCount === 0}
                className="h-8 rounded-lg bg-sky-600 px-3 text-xs font-semibold text-white hover:bg-sky-700"
              >
                {isCreatingChecklistItems ? "Đang thêm..." : "Thêm việc đã chọn"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
