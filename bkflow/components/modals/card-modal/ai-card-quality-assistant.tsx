"use client";

import { useMemo, useState } from "react";
import type { CardLabel, Label } from "@prisma/client";
import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Sparkles, Tag, X } from "lucide-react";
import { toast } from "sonner";

import { applyAiCardLabelSuggestions } from "@/actions/apply-ai-card-label-suggestions";
import { generateAiCardQuality } from "@/actions/generate-ai-card-quality";
import { updateCard } from "@/actions/update-card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAction } from "@/hooks/use-action";
import { cn } from "@/lib/utils";

import { patchBoardCardPreview, patchCardQueryData } from "./card-cache-utils";

type QualityTask = "create_description" | "rewrite_description" | "suggest_labels";

type CardLabelWithLabel = CardLabel & {
  label: Label;
};

interface AiCardQualityAssistantProps {
  boardId: string;
  cardId: string;
  description: string | null;
  labels: CardLabelWithLabel[];
  boardLabels: Label[];
}

const taskLabels: Record<QualityTask, string> = {
  create_description: "Tạo mô tả từ tiêu đề",
  rewrite_description: "Viết lại mô tả",
  suggest_labels: "Gợi ý nhãn",
};

export const AiCardQualityAssistant = ({
  boardId,
  cardId,
  description,
  labels,
  boardLabels,
}: AiCardQualityAssistantProps) => {
  const queryClient = useQueryClient();
  const [activeTask, setActiveTask] = useState<QualityTask | null>(null);
  const [previewDescription, setPreviewDescription] = useState("");
  const [previewLabelIds, setPreviewLabelIds] = useState<string[]>([]);
  const [selectedLabelIds, setSelectedLabelIds] = useState<Set<string>>(new Set());
  const [labelReason, setLabelReason] = useState("");

  const activeLabelIds = useMemo(
    () => new Set(labels.map((item) => item.labelId)),
    [labels],
  );
  const suggestedLabels = useMemo(
    () => previewLabelIds
      .map((labelId) => boardLabels.find((label) => label.id === labelId) ?? null)
      .filter((label): label is Label => !!label),
    [boardLabels, previewLabelIds],
  );
  const selectedLabels = useMemo(
    () => suggestedLabels.filter((label) => selectedLabelIds.has(label.id)),
    [selectedLabelIds, suggestedLabels],
  );
  const hasDescription = !!description?.trim();
  const isDescriptionTask = activeTask === "create_description" || activeTask === "rewrite_description";
  const isLabelTask = activeTask === "suggest_labels";

  const invalidateCard = () => {
    queryClient.invalidateQueries({ queryKey: ["card", cardId] });
    queryClient.invalidateQueries({ queryKey: ["card-logs", cardId] });
  };

  const resetPreview = () => {
    setActiveTask(null);
    setPreviewDescription("");
    setPreviewLabelIds([]);
    setSelectedLabelIds(new Set());
    setLabelReason("");
  };

  const { execute: executeGenerate, isLoading: isGenerating } = useAction(generateAiCardQuality, {
    onSuccess: (data) => {
      setActiveTask(data.task);

      if (data.description) {
        setPreviewDescription(data.description);
        setPreviewLabelIds([]);
        setSelectedLabelIds(new Set());
        setLabelReason("");
        toast.success("AI đã tạo bản nháp mô tả.");
        return;
      }

      const ids = data.labelIds ?? [];
      setPreviewDescription("");
      setPreviewLabelIds(ids);
      setSelectedLabelIds(new Set(ids));
      setLabelReason(data.reason ?? "");

      if (ids.length === 0) {
        toast.info("AI chưa tìm thấy nhãn phù hợp để gợi ý.");
      } else {
        toast.success("AI đã gợi ý nhãn cho thẻ này.");
      }
    },
    onError: (error) => toast.error(error),
  });

  const { execute: executeUpdateCard, isLoading: isUpdatingDescription } = useAction(updateCard, {
    onSuccess: (updatedCard) => {
      patchCardQueryData(queryClient, updatedCard.id, {
        description: updatedCard.description,
      });
      patchBoardCardPreview(boardId, updatedCard.id, {
        description: updatedCard.description,
      });
      invalidateCard();
      toast.success("Đã cập nhật mô tả");
      resetPreview();
    },
    onError: (error) => toast.error(error),
  });

  const { execute: executeApplyLabels, isLoading: isApplyingLabels } = useAction(applyAiCardLabelSuggestions, {
    onSuccess: (data) => {
      const nextLabels = [
        ...labels,
        ...data.labels.map((label) => ({
          id: `temp-ai-label-${label.id}`,
          cardId,
          labelId: label.id,
          createdAt: new Date(),
          updatedAt: new Date(),
          label,
        })),
      ];

      patchCardQueryData(queryClient, cardId, {
        labels: nextLabels,
      });
      patchBoardCardPreview(boardId, cardId, {
        labels: nextLabels,
      });
      invalidateCard();
      toast.success(`Đã gắn ${data.labels.length} nhãn`);
      resetPreview();
    },
    onError: (error) => {
      toast.error(error);
      invalidateCard();
    },
  });

  const handleGenerate = (task: QualityTask) => {
    setActiveTask(task);
    executeGenerate({
      boardId,
      cardId,
      task,
    });
  };

  const handleApplyDescription = () => {
    if (!previewDescription.trim()) {
      return;
    }

    executeUpdateCard({
      id: cardId,
      boardId,
      description: previewDescription,
    });
  };

  const handleToggleLabel = (labelId: string) => {
    setSelectedLabelIds((current) => {
      const next = new Set(current);

      if (next.has(labelId)) {
        next.delete(labelId);
      } else {
        next.add(labelId);
      }

      return next;
    });
  };

  const handleApplyLabels = () => {
    if (selectedLabels.length === 0) {
      return;
    }

    executeApplyLabels({
      boardId,
      cardId,
      labelIds: selectedLabels.map((label) => label.id),
    });
  };

  const isBusy = isGenerating || isUpdatingDescription || isApplyingLabels;

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
                ) : task === "suggest_labels" ? (
                  <Tag className="mr-1.5 h-3.5 w-3.5" />
                ) : (
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                )}
                {isGenerating && activeTask === task ? "Đang tạo..." : taskLabels[task]}
              </Button>
            );
          })}
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
              <Button
                type="button"
                onClick={handleApplyDescription}
                disabled={isBusy || !previewDescription.trim()}
                className="h-8 rounded-lg bg-sky-600 px-3 text-xs font-semibold text-white hover:bg-sky-700"
              >
                {isUpdatingDescription ? "Đang áp dụng..." : "Áp dụng mô tả"}
              </Button>
            </div>
          </div>
        )}

        {isLabelTask && (
          <div className="mt-3 space-y-3 rounded-lg border border-white/70 bg-white p-3 shadow-xs">
            {suggestedLabels.length > 0 ? (
              <>
                {labelReason && (
                  <p className="text-xs font-medium text-neutral-500">
                    {labelReason}
                  </p>
                )}
                <div className="space-y-1.5">
                  {suggestedLabels.map((label) => (
                    <label
                      key={label.id}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-lg border border-neutral-100 px-3 py-2 text-sm text-neutral-700 transition hover:bg-neutral-50",
                        isBusy && "cursor-wait opacity-70",
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={selectedLabelIds.has(label.id)}
                        onChange={() => handleToggleLabel(label.id)}
                        disabled={isBusy || activeLabelIds.has(label.id)}
                        className="h-4 w-4 rounded border-neutral-300 accent-sky-600"
                      />
                      <span
                        className="h-3 w-8 rounded-full border border-black/5"
                        style={{ backgroundColor: label.color }}
                      />
                      <span className="font-semibold">{label.title || "Không tên"}</span>
                    </label>
                  ))}
                </div>
              </>
            ) : (
              <div className="rounded-lg border border-dashed border-neutral-200 bg-neutral-50 px-3 py-5 text-center text-xs font-medium text-neutral-500">
                AI chưa tìm thấy nhãn phù hợp từ danh sách nhãn hiện có.
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100 pt-3">
              <span className="text-xs font-medium text-neutral-500">
                Đã chọn {selectedLabels.length}/{suggestedLabels.length} nhãn
              </span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleGenerate("suggest_labels")}
                  disabled={isBusy}
                  className="h-8 rounded-lg px-3 text-xs font-semibold"
                >
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                  Tạo lại
                </Button>
                <Button
                  type="button"
                  onClick={handleApplyLabels}
                  disabled={isBusy || selectedLabels.length === 0}
                  className="h-8 rounded-lg bg-sky-600 px-3 text-xs font-semibold text-white hover:bg-sky-700"
                >
                  {isApplyingLabels ? "Đang gắn..." : "Gắn nhãn đã chọn"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
