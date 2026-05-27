"use client";

import { useMemo, useState } from "react";
import { Bot, Loader2, Plus, Sparkles, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { BoardMember, Label, List } from "@prisma/client";

import { analyzeSmartCapture } from "@/actions/ai/analyze-smart-capture";
import { SMART_CAPTURE_RAW_TEXT_MAX_LENGTH } from "@/actions/ai/analyze-smart-capture/schema";
import type { SmartCaptureDraft } from "@/actions/ai/analyze-smart-capture/types";
import { createSmartCaptureCard } from "@/actions/cards/create-smart-capture-card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAction } from "@/hooks/use-action";
import { useCardModal } from "@/hooks/use-card-modal";
import { cn } from "@/lib/utils";

type SmartCaptureDialogProps = {
  boardId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lists: Pick<List, "id" | "title">[];
  members: Pick<BoardMember, "id" | "userName" | "userEmail">[];
  labels: Pick<Label, "id" | "title" | "color">[];
};

type DialogStep = "input" | "preview";

const emptyDraft = (listId: string): SmartCaptureDraft => ({
  title: "",
  description: "",
  checklistItems: [],
  dueDateIso: null,
  assigneeBoardMemberId: null,
  labelIds: [],
  listId,
  suggestedLabelIds: [],
});

const toDatetimeLocalValue = (value: string | null) => {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);

  return offsetDate.toISOString().slice(0, 16);
};

const fromDatetimeLocalValue = (value: string) => {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const getTimezoneLabel = () => {
  const offsetMinutes = -new Date().getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absoluteMinutes = Math.abs(offsetMinutes);
  const hours = Math.floor(absoluteMinutes / 60).toString().padStart(2, "0");
  const minutes = (absoluteMinutes % 60).toString().padStart(2, "0");

  return `UTC${sign}${hours}:${minutes}`;
};

const normalizeChecklistItems = (items: string[]) =>
  items
    .map((item) => item.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .filter((item, index, allItems) =>
      allItems.findIndex((candidate) => candidate.toLowerCase() === item.toLowerCase()) === index,
    )
    .slice(0, 20);

export const SmartCaptureDialog = ({
  boardId,
  open,
  onOpenChange,
  lists,
  members,
  labels,
}: SmartCaptureDialogProps) => {
  const router = useRouter();
  const cardModal = useCardModal();
  const fallbackListId = lists[0]?.id ?? "";
  const [step, setStep] = useState<DialogStep>("input");
  const [rawText, setRawText] = useState("");
  const [draft, setDraft] = useState<SmartCaptureDraft>(() => emptyDraft(fallbackListId));
  const [newChecklistItem, setNewChecklistItem] = useState("");
  const trimmedRawTextLength = rawText.trim().length;
  const isRawTextTooLong = trimmedRawTextLength > SMART_CAPTURE_RAW_TEXT_MAX_LENGTH;
  const suggestedLabelIds = useMemo(
    () => new Set(draft.suggestedLabelIds),
    [draft.suggestedLabelIds],
  );

  const resetDialog = () => {
    setStep("input");
    setRawText("");
    setDraft(emptyDraft(fallbackListId));
    setNewChecklistItem("");
  };

  const closeDialog = () => {
    onOpenChange(false);
    resetDialog();
  };

  const { execute: executeAnalyze, isLoading: isAnalyzing } = useAction(analyzeSmartCapture, {
    onSuccess: (data) => {
      setDraft({
        ...data,
        listId: lists.some((list) => list.id === data.listId)
          ? data.listId
          : fallbackListId,
      });
      setStep("preview");
    },
    onError: (error) => {
      toast.error(error);
    },
  });

  const { execute: executeCreate, isLoading: isCreating } = useAction(createSmartCaptureCard, {
    onSuccess: (data) => {
      toast.success("Đã tạo thẻ từ Smart Capture.");
      closeDialog();
      router.refresh();
      cardModal.onOpen(data.id);
    },
    onError: (error) => {
      toast.error(error);
    },
  });

  const updateDraft = <TKey extends keyof SmartCaptureDraft>(
    key: TKey,
    value: SmartCaptureDraft[TKey],
  ) => {
    setDraft((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const onAnalyze = () => {
    if (lists.length === 0) {
      toast.error("Bảng chưa có cột để tạo thẻ.");
      return;
    }

    if (!rawText.trim()) {
      toast.error("Vui lòng dán nội dung cần phân tích.");
      return;
    }

    if (isRawTextTooLong) {
      toast.error("Nội dung quá dài. Vui lòng rút gọn tối đa 4000 ký tự.");
      return;
    }

    executeAnalyze({
      boardId,
      rawText,
      timezoneOffsetMinutes: new Date().getTimezoneOffset(),
      nowIso: new Date().toISOString(),
      timezoneLabel: getTimezoneLabel(),
      localNowIso: toDatetimeLocalValue(new Date().toISOString()),
    });
  };

  const onToggleLabel = (labelId: string) => {
    const activeLabelIds = new Set(draft.labelIds);

    if (activeLabelIds.has(labelId)) {
      activeLabelIds.delete(labelId);
    } else {
      activeLabelIds.add(labelId);
    }

    updateDraft("labelIds", Array.from(activeLabelIds));
  };

  const onChecklistItemChange = (index: number, value: string) => {
    updateDraft(
      "checklistItems",
      draft.checklistItems.map((item, itemIndex) => itemIndex === index ? value : item),
    );
  };

  const onRemoveChecklistItem = (index: number) => {
    updateDraft(
      "checklistItems",
      draft.checklistItems.filter((_, itemIndex) => itemIndex !== index),
    );
  };

  const onAddChecklistItem = () => {
    const title = newChecklistItem.replace(/\s+/g, " ").trim();

    if (!title) {
      return;
    }

    updateDraft("checklistItems", normalizeChecklistItems([...draft.checklistItems, title]));
    setNewChecklistItem("");
  };

  const onCreateCard = () => {
    const title = draft.title.replace(/\s+/g, " ").trim();

    if (!title) {
      toast.error("Vui lòng nhập tiêu đề thẻ.");
      return;
    }

    if (!draft.listId) {
      toast.error("Vui lòng chọn cột đích.");
      return;
    }

    executeCreate({
      boardId,
      listId: draft.listId,
      title,
      description: draft.description,
      dueDate: draft.dueDateIso,
      assigneeBoardMemberId: draft.assigneeBoardMemberId,
      labelIds: draft.labelIds,
      checklistItems: normalizeChecklistItems(draft.checklistItems),
    });
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      if (!nextOpen) {
        closeDialog();
        return;
      }

      onOpenChange(nextOpen);
    }}>
      <DialogContent
        style={{
          display: "flex",
          flexDirection: "column",
          height: "780px",
          maxHeight: "calc(100vh - 32px)",
        }}
        className="w-[calc(100vw-2rem)] max-w-4xl overflow-hidden rounded-2xl border border-neutral-200 bg-white p-0 shadow-2xl sm:max-w-4xl"
        showCloseButton={false}
      >
        <DialogHeader className="border-b border-neutral-200 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <DialogTitle className="flex items-center gap-2 text-base font-semibold text-neutral-900">
                <Sparkles className="h-4 w-4 text-violet-600" />
                AI Inbox / Smart Capture
              </DialogTitle>
              <DialogDescription className="mt-1 text-sm text-neutral-500">
                Chuyển nội dung thô thành một thẻ công việc có cấu trúc.
              </DialogDescription>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={closeDialog}
              disabled={isAnalyzing || isCreating}
              className="h-8 w-8 shrink-0 rounded-lg p-0 text-neutral-400 hover:text-neutral-700"
              aria-label="Đóng Smart Capture"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto p-5 styled-scrollbar">
          {step === "input" ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <label htmlFor="smart-capture-raw-text" className="text-sm font-semibold text-neutral-700">
                    Nội dung nguồn
                  </label>
                  <span
                    className={cn(
                      "text-xs font-medium",
                      isRawTextTooLong ? "text-red-600" : "text-neutral-400",
                    )}
                  >
                    {trimmedRawTextLength}/{SMART_CAPTURE_RAW_TEXT_MAX_LENGTH}
                  </span>
                </div>
                <textarea
                  id="smart-capture-raw-text"
                  value={rawText}
                  onChange={(event) => setRawText(event.target.value)}
                  placeholder="Dán tin nhắn Slack, Email hoặc biên bản họp vào đây để AI tự động soạn thẻ..."
                  disabled={isAnalyzing}
                  rows={22}
                  style={{
                    height: "min(590px, calc(100vh - 220px))",
                    minHeight: "500px",
                  }}
                  className="block w-full resize-none overflow-y-scroll rounded-xl border border-neutral-200 bg-neutral-50/60 p-4 text-sm leading-6 text-neutral-800 shadow-inner outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-200 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:opacity-70 styled-scrollbar"
                />
              </div>

              {isAnalyzing && (
                <div className="rounded-xl border border-violet-100 bg-violet-50/60 p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-medium text-violet-700">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    AI đang đọc và phân tích tin nhắn của bạn...
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-3/4 bg-violet-100" />
                    <Skeleton className="h-4 w-2/3 bg-violet-100" />
                    <Skeleton className="h-4 w-5/6 bg-violet-100" />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="grid min-h-0 gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
              <div className="min-h-0 space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="smart-capture-title" className="text-xs font-bold uppercase text-neutral-500">
                    Tiêu đề thẻ
                  </label>
                  <Input
                    id="smart-capture-title"
                    value={draft.title}
                    onChange={(event) => updateDraft("title", event.target.value)}
                    disabled={isCreating}
                    className="h-10 rounded-lg border-neutral-200 text-sm focus-visible:border-violet-500 focus-visible:ring-violet-200"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="smart-capture-description" className="text-xs font-bold uppercase text-neutral-500">
                    Mô tả thẻ
                  </label>
                  <textarea
                    id="smart-capture-description"
                    value={draft.description}
                    onChange={(event) => updateDraft("description", event.target.value)}
                    disabled={isCreating}
                    rows={18}
                    style={{
                      height: "430px",
                      maxHeight: "430px",
                      minHeight: "430px",
                    }}
                    className="block w-full resize-none overflow-y-scroll rounded-lg border border-neutral-200 bg-white px-2.5 py-2 font-mono text-xs leading-5 text-neutral-800 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-200 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:opacity-70 styled-scrollbar"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <label className="text-xs font-bold uppercase text-neutral-500">
                      Checklist
                    </label>
                    <span className="text-xs text-neutral-400">
                      {draft.checklistItems.length}/20
                    </span>
                  </div>
                  <div className="space-y-2">
                    {draft.checklistItems.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-neutral-200 p-3 text-sm text-neutral-400">
                        Chưa có đầu việc con.
                      </div>
                    ) : (
                      draft.checklistItems.map((item, index) => (
                        <div key={`${index}-${item}`} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            disabled
                            className="h-4 w-4 rounded border-neutral-300"
                            aria-label="Checklist item preview"
                          />
                          <Input
                            value={item}
                            onChange={(event) => onChecklistItemChange(index, event.target.value)}
                            disabled={isCreating}
                            className="h-9 rounded-lg border-neutral-200 text-sm"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => onRemoveChecklistItem(index)}
                            disabled={isCreating}
                            className="h-9 w-9 shrink-0 rounded-lg p-0 text-neutral-400 hover:text-red-600"
                            aria-label="Xóa checklist item"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))
                    )}
                    <div className="flex items-center gap-2">
                      <Input
                        value={newChecklistItem}
                        onChange={(event) => setNewChecklistItem(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            onAddChecklistItem();
                          }
                        }}
                        disabled={isCreating || draft.checklistItems.length >= 20}
                        placeholder="Thêm đầu việc..."
                        className="h-9 rounded-lg border-neutral-200 text-sm"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={onAddChecklistItem}
                        disabled={isCreating || draft.checklistItems.length >= 20}
                        className="h-9 shrink-0 rounded-lg"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4 rounded-xl border border-neutral-200 bg-neutral-50/70 p-4">
                <div className="space-y-1.5">
                  <label htmlFor="smart-capture-list" className="text-xs font-bold uppercase text-neutral-500">
                    Cột đích
                  </label>
                  <select
                    id="smart-capture-list"
                    value={draft.listId}
                    onChange={(event) => updateDraft("listId", event.target.value)}
                    disabled={isCreating}
                    className="h-9 w-full rounded-lg border border-neutral-200 bg-white px-2.5 text-sm text-neutral-700 outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-200"
                  >
                    {lists.map((list) => (
                      <option key={list.id} value={list.id}>
                        {list.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="smart-capture-due-date" className="text-xs font-bold uppercase text-neutral-500">
                    Hạn chót
                  </label>
                  <Input
                    id="smart-capture-due-date"
                    type="datetime-local"
                    value={toDatetimeLocalValue(draft.dueDateIso)}
                    onChange={(event) => updateDraft("dueDateIso", fromDatetimeLocalValue(event.target.value))}
                    disabled={isCreating}
                    className="h-9 rounded-lg border-neutral-200 text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="smart-capture-assignee" className="text-xs font-bold uppercase text-neutral-500">
                    Người thực hiện
                  </label>
                  <select
                    id="smart-capture-assignee"
                    value={draft.assigneeBoardMemberId ?? ""}
                    onChange={(event) => updateDraft("assigneeBoardMemberId", event.target.value || null)}
                    disabled={isCreating}
                    className="h-9 w-full rounded-lg border border-neutral-200 bg-white px-2.5 text-sm text-neutral-700 outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-200"
                  >
                    <option value="">Không chọn</option>
                    {members.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.userName}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-neutral-500">
                    Nhãn công việc
                  </label>
                  <div className="max-h-[220px] space-y-2 overflow-y-auto pr-1 styled-scrollbar">
                    {labels.length === 0 ? (
                      <p className="rounded-lg border border-dashed border-neutral-200 bg-white p-3 text-xs text-neutral-400">
                        Bảng chưa có nhãn.
                      </p>
                    ) : (
                      labels.map((label) => {
                        const isSelected = draft.labelIds.includes(label.id);
                        const isSuggested = suggestedLabelIds.has(label.id);

                        return (
                          <button
                            key={label.id}
                            type="button"
                            onClick={() => onToggleLabel(label.id)}
                            disabled={isCreating}
                            className={cn(
                              "flex w-full items-center gap-2 rounded-lg border bg-white p-2 text-left text-xs transition hover:border-violet-300",
                              isSelected ? "border-violet-400 ring-1 ring-violet-200" : "border-neutral-200",
                              isSuggested && "shadow-[0_0_0_2px_rgba(124,58,237,0.10)]",
                            )}
                          >
                            <span
                              className="h-4 w-4 shrink-0 rounded"
                              style={{ backgroundColor: label.color }}
                            />
                            <span className="min-w-0 flex-1 truncate font-medium text-neutral-700">
                              {label.title || "Không tên"}
                            </span>
                            {isSuggested && (
                              <Bot className="h-3.5 w-3.5 shrink-0 text-violet-500" />
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-neutral-200 bg-neutral-50 px-5 py-4">
          {step === "preview" ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setStep("input")}
              disabled={isCreating}
              className="rounded-lg text-neutral-600"
            >
              Quay lại
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              onClick={closeDialog}
              disabled={isAnalyzing}
              className="rounded-lg text-neutral-600"
            >
              Hủy
            </Button>
          )}

          <div className="flex items-center gap-2">
            {step === "preview" && (
              <Button
                type="button"
                variant="ghost"
                onClick={closeDialog}
                disabled={isCreating}
                className="rounded-lg text-neutral-600"
              >
                Hủy
              </Button>
            )}
            {step === "input" ? (
              <Button
                type="button"
                onClick={onAnalyze}
                disabled={isAnalyzing || !trimmedRawTextLength || isRawTextTooLong || lists.length === 0}
                className="rounded-lg bg-violet-600 text-white hover:bg-violet-700"
              >
                {isAnalyzing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                Phân tích nội dung
              </Button>
            ) : (
              <Button
                type="button"
                onClick={onCreateCard}
                disabled={isCreating || !draft.title.trim() || !draft.listId}
                className="rounded-lg bg-violet-600 text-white hover:bg-violet-700"
              >
                {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Tạo thẻ
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
