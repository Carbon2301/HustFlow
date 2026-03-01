"use client";

import { useMemo, useState } from "react";
import type { Checklist } from "@prisma/client";
import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Sparkles, X } from "lucide-react";
import { toast } from "sonner";

import { createAiChecklistItems } from "@/actions/create-ai-checklist-items";
import { generateAiChecklist } from "@/actions/generate-ai-checklist";
import { Button } from "@/components/ui/button";
import { useAction } from "@/hooks/use-action";
import { cn } from "@/lib/utils";

type ChecklistOption = Checklist & {
  items: {
    id: string;
    title: string;
  }[];
};

interface AiChecklistGeneratorProps {
  boardId: string;
  cardId: string;
  checklists: ChecklistOption[];
}

const NEW_CHECKLIST_VALUE = "__new__";
const DEFAULT_CHECKLIST_TITLE = "Việc cần làm";

export const AiChecklistGenerator = ({
  boardId,
  cardId,
  checklists,
}: AiChecklistGeneratorProps) => {
  const queryClient = useQueryClient();
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [selectedChecklistId, setSelectedChecklistId] = useState(
    checklists[0]?.id ?? NEW_CHECKLIST_VALUE,
  );

  const selectedCount = useMemo(
    () => suggestions.filter((item) => selectedItems.has(item)).length,
    [selectedItems, suggestions],
  );
  const hasPreview = suggestions.length > 0;
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

  const { execute: executeGenerate, isLoading: isGenerating } = useAction(generateAiChecklist, {
    onSuccess: (data) => {
      setSuggestions(data.items);
      setSelectedItems(new Set(data.items));
      toast.success("AI đã gợi ý checklist cho thẻ này.");
    },
    onError: (error) => toast.error(error),
  });

  const { execute: executeCreateItems, isLoading: isCreating } = useAction(createAiChecklistItems, {
    onSuccess: (data) => {
      toast.success(`Đã thêm ${data.items.length} mục checklist`);
      setSuggestions([]);
      setSelectedItems(new Set());
      invalidateCard();
    },
    onError: (error) => {
      toast.error(error);
      invalidateCard();
    },
  });

  const handleGenerate = () => {
    executeGenerate({
      boardId,
      cardId,
    });
  };

  const handleToggleItem = (item: string) => {
    setSelectedItems((current) => {
      const next = new Set(current);

      if (next.has(item)) {
        next.delete(item);
      } else {
        next.add(item);
      }

      return next;
    });
  };

  const handleConfirm = () => {
    const items = suggestions.filter((item) => selectedItems.has(item));

    if (items.length === 0) {
      return;
    }

    executeCreateItems({
      boardId,
      cardId,
      checklistId: effectiveChecklistId === NEW_CHECKLIST_VALUE
        ? undefined
        : effectiveChecklistId,
      checklistTitle: DEFAULT_CHECKLIST_TITLE,
      items,
    });
  };

  const handleCancel = () => {
    setSuggestions([]);
    setSelectedItems(new Set());
  };

  const isBusy = isGenerating || isCreating;

  return (
    <div className="flex items-start gap-x-4 w-full">
      <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Sparkles className="h-5 w-5 text-violet-500" />
      </div>
      <div className="w-full min-w-0 rounded-xl border border-violet-100 bg-violet-50/40 p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-neutral-800">
              Gợi ý checklist bằng AI
            </p>
            {!hasPreview && (
              <p className="mt-0.5 text-xs text-neutral-500">
                AI sẽ tạo bản nháp để bạn chọn trước khi thêm vào thẻ.
              </p>
            )}
          </div>
          <Button
            type="button"
            onClick={handleGenerate}
            disabled={isBusy}
            variant="outline"
            className="h-8 rounded-lg border-violet-200 bg-white px-3 text-xs font-semibold text-violet-700 hover:bg-violet-50"
          >
            {hasPreview ? (
              <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", isGenerating && "animate-spin")} />
            ) : (
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            )}
            {isGenerating ? "Đang gợi ý..." : hasPreview ? "Tạo lại" : "Gợi ý checklist"}
          </Button>
        </div>

        {hasPreview && (
          <div className="mt-3 space-y-3 rounded-lg border border-white/70 bg-white p-3 shadow-xs">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              {canSelectChecklist ? (
                <label className="flex min-w-0 flex-1 items-center gap-2 text-xs font-semibold text-neutral-600">
                  Thêm vào
                  <select
                    value={effectiveChecklistId}
                    onChange={(event) => setSelectedChecklistId(event.target.value)}
                    disabled={isBusy}
                    className="h-8 min-w-0 flex-1 rounded-lg border border-neutral-200 bg-white px-2 text-xs text-neutral-700 outline-none transition focus:border-violet-400 focus:ring-1 focus:ring-violet-200"
                  >
                    {checklists.map((checklist) => (
                      <option key={checklist.id} value={checklist.id}>
                        {checklist.title}
                      </option>
                    ))}
                    <option value={NEW_CHECKLIST_VALUE}>
                      Tạo checklist mới: {DEFAULT_CHECKLIST_TITLE}
                    </option>
                  </select>
                </label>
              ) : (
                <p className="text-xs font-semibold text-neutral-600">
                  Sẽ tạo checklist mới: {DEFAULT_CHECKLIST_TITLE}
                </p>
              )}
              <button
                type="button"
                onClick={handleCancel}
                disabled={isBusy}
                className="inline-flex h-8 items-center justify-center rounded-lg px-2 text-xs font-semibold text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-50"
              >
                <X className="mr-1 h-3.5 w-3.5" />
                Hủy
              </button>
            </div>

            <div className="space-y-1.5">
              {suggestions.map((item) => (
                <label
                  key={item}
                  className={cn(
                    "flex cursor-pointer items-start gap-2 rounded-lg border border-neutral-100 px-3 py-2 text-sm text-neutral-700 transition hover:bg-neutral-50",
                    isBusy && "cursor-wait opacity-70",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={selectedItems.has(item)}
                    onChange={() => handleToggleItem(item)}
                    disabled={isBusy}
                    className="mt-1 h-4 w-4 rounded border-neutral-300 accent-violet-600"
                  />
                  <span className="leading-relaxed">{item}</span>
                </label>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100 pt-3">
              <span className="text-xs font-medium text-neutral-500">
                Đã chọn {selectedCount}/{suggestions.length} mục
              </span>
              <Button
                type="button"
                onClick={handleConfirm}
                disabled={isBusy || selectedCount === 0}
                className="h-8 rounded-lg bg-violet-600 px-3 text-xs font-semibold text-white hover:bg-violet-700"
              >
                {isCreating ? "Đang thêm..." : "Thêm mục đã chọn"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
