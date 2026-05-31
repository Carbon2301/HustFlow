"use client";

import { useMemo, useState } from "react";
import type { Checklist } from "@prisma/client";
import { useQueryClient } from "@tanstack/react-query";
import { CheckSquare, RefreshCw, Sparkles, X } from "lucide-react";
import { toast } from "sonner";

import { createAiChecklistItems } from "@/actions/ai/create-ai-checklist-items";
import { generateAiChecklist } from "@/actions/ai/generate-ai-checklist";
import { Button } from "@/components/ui/button";
import { useAction } from "@/hooks/use-action";
import { cn } from "@/lib/utils";

type ChecklistOption = Checklist & {
  items: {
    id: string;
    title: string;
  }[];
};

interface AiCardQualityAssistantProps {
  boardId: string;
  cardId: string;
  checklists: ChecklistOption[];
}

const NEW_CHECKLIST_VALUE = "__new__";
const DEFAULT_CHECKLIST_TITLE = "Việc cần làm";

export const AiCardQualityAssistant = ({
  boardId,
  cardId,
  checklists,
}: AiCardQualityAssistantProps) => {
  const queryClient = useQueryClient();
  const [activeTask, setActiveTask] = useState<"suggest_checklist" | null>(null);
  const [checklistSuggestions, setChecklistSuggestions] = useState<string[]>([]);
  const [selectedChecklistItems, setSelectedChecklistItems] = useState<Set<string>>(new Set());
  const [selectedChecklistId, setSelectedChecklistId] = useState(
    checklists[0]?.id ?? NEW_CHECKLIST_VALUE,
  );

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
    setChecklistSuggestions([]);
    setSelectedChecklistItems(new Set());
  };

  const { execute: executeGenerateChecklist, isLoading: isGeneratingChecklist } = useAction(generateAiChecklist, {
    onSuccess: (data) => {
      setActiveTask("suggest_checklist");
      setChecklistSuggestions(data.items);
      setSelectedChecklistItems(new Set(data.items));
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

  const handleGenerateChecklist = () => {
    setActiveTask("suggest_checklist");
    executeGenerateChecklist({
      boardId,
      cardId,
    });
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

  const isBusy = isGeneratingChecklist || isCreatingChecklistItems;

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
              Gợi ý các việc cần làm phù hợp với ngữ cảnh của thẻ.
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
