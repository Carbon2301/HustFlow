"use client";

import { useMemo, useState } from "react";
import { AlignLeft, Bot, Calendar, CheckSquare, FileText, LayoutGrid, Loader2, Plus, Sparkles, Tag, Trash2, Type, User, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { BoardMember, Label, List } from "@prisma/client";

import { analyzeSmartCapture } from "@/actions/ai/analyze-smart-capture";
import { SMART_CAPTURE_RAW_TEXT_MAX_LENGTH } from "@/actions/ai/analyze-smart-capture/schema";
import type { SmartCaptureDraft } from "@/actions/ai/analyze-smart-capture/types";
import { createSmartCaptureCards } from "@/actions/cards/create-smart-capture-card";
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
import { isAssignableBoardMember } from "@/lib/boards/board-member-role";
import { cn } from "@/lib/utils";

type SmartCaptureDialogProps = {
  boardId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lists: Pick<List, "id" | "title">[];
  members: Pick<BoardMember, "id" | "userName" | "userEmail" | "role">[];
  labels: Pick<Label, "id" | "title" | "color">[];
};

type DialogStep = "input" | "preview";

type EditableSmartCaptureDraft = SmartCaptureDraft & {
  localId: string;
  isSelected: boolean;
  selectedChecklistTitles: string[];
};

const createLocalId = (index: number) =>
  `smart-capture-draft-${index}-${globalThis.crypto?.randomUUID?.() ?? Date.now().toString()}`;

const toEditableDraft = (
  draft: SmartCaptureDraft,
  index: number,
  fallbackListId: string,
  lists: Pick<List, "id" | "title">[],
  assignableMembers: Pick<BoardMember, "id" | "userName" | "userEmail" | "role">[],
): EditableSmartCaptureDraft => ({
  ...draft,
  localId: createLocalId(index),
  isSelected: true,
  selectedChecklistTitles: draft.checklistItems,
  assigneeBoardMemberIds: draft.assigneeBoardMemberIds.filter((memberId) =>
    assignableMembers.some((member) => member.id === memberId),
  ),
  suggestedAssigneeBoardMemberIds: draft.suggestedAssigneeBoardMemberIds.filter((memberId) =>
    assignableMembers.some((member) => member.id === memberId),
  ),
  listId: lists.some((list) => list.id === draft.listId)
    ? draft.listId
    : fallbackListId,
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

const formatDueDate = (value: string | null) => {
  if (!value) {
    return "Chưa có hạn";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Hạn không hợp lệ";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
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
  const [drafts, setDrafts] = useState<EditableSmartCaptureDraft[]>([]);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [splitSummary, setSplitSummary] = useState("");
  const [newChecklistItem, setNewChecklistItem] = useState("");
  const assignableMembers = useMemo(
    () => members.filter(isAssignableBoardMember),
    [members],
  );
  const trimmedRawTextLength = rawText.trim().length;
  const isRawTextTooLong = trimmedRawTextLength > SMART_CAPTURE_RAW_TEXT_MAX_LENGTH;
  const activeDraft = drafts.find((draft) => draft.localId === activeDraftId) ?? drafts[0] ?? null;
  const selectedDraftCount = drafts.filter((draft) => draft.isSelected).length;
  const selectedDrafts = drafts.filter((draft) => draft.isSelected);
  const allDraftsSelected = drafts.length > 0 && selectedDraftCount === drafts.length;
  const suggestedLabelIds = useMemo(
    () => new Set(activeDraft?.suggestedLabelIds ?? []),
    [activeDraft?.suggestedLabelIds],
  );
  const suggestedAssigneeIds = useMemo(
    () => new Set(activeDraft?.suggestedAssigneeBoardMemberIds ?? []),
    [activeDraft?.suggestedAssigneeBoardMemberIds],
  );

  const getListTitle = (listId: string) =>
    lists.find((list) => list.id === listId)?.title ?? "Danh sách";

  const resetDialog = () => {
    setStep("input");
    setRawText("");
    setDrafts([]);
    setActiveDraftId(null);
    setSplitSummary("");
    setNewChecklistItem("");
  };

  const closeDialog = () => {
    onOpenChange(false);
    resetDialog();
  };

  const updateDraft = <TKey extends keyof SmartCaptureDraft>(
    localId: string,
    key: TKey,
    value: SmartCaptureDraft[TKey],
  ) => {
    setDrafts((current) =>
      current.map((draft) =>
        draft.localId === localId
          ? {
              ...draft,
              [key]: value,
            }
          : draft,
      ),
    );
  };

  const updateEditableDraft = (
    localId: string,
    updater: (draft: EditableSmartCaptureDraft) => EditableSmartCaptureDraft,
  ) => {
    setDrafts((current) =>
      current.map((draft) => draft.localId === localId ? updater(draft) : draft),
    );
  };

  const { execute: executeAnalyze, isLoading: isAnalyzing } = useAction(analyzeSmartCapture, {
    onSuccess: (data) => {
      const nextDrafts = data.drafts.map((draft, index) =>
        toEditableDraft(draft, index, fallbackListId, lists, assignableMembers),
      );

      setDrafts(nextDrafts);
      setActiveDraftId(nextDrafts[0]?.localId ?? null);
      setSplitSummary(data.splitSummary);
      setNewChecklistItem("");
      setStep("preview");
    },
    onError: (error) => {
      toast.error(error);
    },
  });

  const { execute: executeCreate, isLoading: isCreating } = useAction(createSmartCaptureCards, {
    onSuccess: (data) => {
      toast.success(`Đã tạo ${data.length} thẻ từ Smart Capture.`);
      closeDialog();
      router.refresh();

      if (data[0]) {
        cardModal.onOpen(data[0].id);
      }
    },
    onError: (error) => {
      toast.error(error);
    },
  });

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

  const onToggleDraftSelection = (localId: string) => {
    updateEditableDraft(localId, (draft) => ({
      ...draft,
      isSelected: !draft.isSelected,
    }));
  };

  const onToggleAllDrafts = () => {
    setDrafts((current) =>
      current.map((draft) => ({
        ...draft,
        isSelected: !allDraftsSelected,
      })),
    );
  };

  const onDeleteDraft = (localId: string) => {
    const nextDrafts = drafts.filter((draft) => draft.localId !== localId);

    setDrafts(nextDrafts);

    if (activeDraftId === localId) {
      setActiveDraftId(nextDrafts[0]?.localId ?? null);
      setNewChecklistItem("");
    }
  };

  const onToggleLabel = (labelId: string) => {
    if (!activeDraft) {
      return;
    }

    const activeLabelIds = new Set(activeDraft.labelIds);

    if (activeLabelIds.has(labelId)) {
      activeLabelIds.delete(labelId);
    } else {
      activeLabelIds.add(labelId);
    }

    updateDraft(activeDraft.localId, "labelIds", Array.from(activeLabelIds));
  };

  const onToggleAssignee = (memberId: string) => {
    if (!activeDraft) {
      return;
    }

    const activeAssigneeIds = new Set(activeDraft.assigneeBoardMemberIds);

    if (activeAssigneeIds.has(memberId)) {
      activeAssigneeIds.delete(memberId);
    } else {
      activeAssigneeIds.add(memberId);
    }

    updateDraft(activeDraft.localId, "assigneeBoardMemberIds", Array.from(activeAssigneeIds));
  };

  const onChecklistItemChange = (index: number, value: string) => {
    if (!activeDraft) {
      return;
    }

    const oldValue = activeDraft.checklistItems[index];

    updateEditableDraft(activeDraft.localId, (draft) => ({
      ...draft,
      checklistItems: draft.checklistItems.map((item, itemIndex) =>
        itemIndex === index ? value : item,
      ),
      selectedChecklistTitles: draft.selectedChecklistTitles.includes(oldValue)
        ? [
            ...draft.selectedChecklistTitles.filter((item) => item !== oldValue),
            value,
          ]
        : draft.selectedChecklistTitles,
    }));
  };

  const onToggleChecklistItem = (item: string) => {
    if (!activeDraft) {
      return;
    }

    updateEditableDraft(activeDraft.localId, (draft) => {
      const selectedChecklistTitles = new Set(draft.selectedChecklistTitles);

      if (selectedChecklistTitles.has(item)) {
        selectedChecklistTitles.delete(item);
      } else {
        selectedChecklistTitles.add(item);
      }

      return {
        ...draft,
        selectedChecklistTitles: Array.from(selectedChecklistTitles),
      };
    });
  };

  const onAddChecklistItem = () => {
    if (!activeDraft) {
      return;
    }

    const title = newChecklistItem.replace(/\s+/g, " ").trim();

    if (!title) {
      return;
    }

    updateEditableDraft(activeDraft.localId, (draft) => ({
      ...draft,
      checklistItems: normalizeChecklistItems([...draft.checklistItems, title]),
      selectedChecklistTitles: normalizeChecklistItems([...draft.selectedChecklistTitles, title]),
    }));
    setNewChecklistItem("");
  };

  const onCreateCards = () => {
    if (selectedDrafts.length === 0) {
      toast.error("Vui lòng chọn ít nhất một bản nháp để tạo thẻ.");
      return;
    }

    const invalidDraft = selectedDrafts.find((draft) =>
      !draft.title.replace(/\s+/g, " ").trim() || !draft.listId,
    );

    if (invalidDraft) {
      toast.error("Một bản nháp đang thiếu tiêu đề hoặc danh sách đích.");
      setActiveDraftId(invalidDraft.localId);
      return;
    }

    executeCreate({
      boardId,
      drafts: selectedDrafts.map((draft) => ({
        listId: draft.listId,
        title: draft.title.replace(/\s+/g, " ").trim(),
        description: draft.description,
        dueDate: draft.dueDateIso,
        assigneeBoardMemberIds: draft.assigneeBoardMemberIds.filter((memberId) =>
          assignableMembers.some((member) => member.id === memberId),
        ),
        labelIds: draft.labelIds,
        checklistItems: normalizeChecklistItems(
          draft.checklistItems.filter((item) => draft.selectedChecklistTitles.includes(item)),
        ),
      })),
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
          height: "700px",
          maxHeight: "calc(100vh - 32px)",
        }}
        className={cn(
          "w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-neutral-200 bg-white p-0 shadow-2xl",
          step === "preview" ? "max-w-7xl sm:max-w-7xl" : "max-w-3xl sm:max-w-3xl",
        )}
        showCloseButton={false}
      >
        <DialogHeader className="border-b border-neutral-200 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <DialogTitle className="flex items-center gap-2 text-base font-semibold text-neutral-900">
                <Sparkles className="h-4 w-4 text-violet-600" />
                Tạo nhanh thông minh
              </DialogTitle>
              <DialogDescription className="mt-1 text-sm text-neutral-500">
                Phân tích nội dung nguồn thành một hoặc nhiều bản nháp thẻ có kiểm soát.
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
                  <label htmlFor="smart-capture-raw-text" className="inline-flex items-center gap-1.5 rounded-md bg-violet-50 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-violet-700">
                    Nội dung nguồn
                  </label>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-semibold",
                      isRawTextTooLong ? "bg-red-50 text-red-600" : "bg-neutral-100 text-neutral-500",
                    )}
                  >
                    {trimmedRawTextLength}/{SMART_CAPTURE_RAW_TEXT_MAX_LENGTH}
                  </span>
                </div>
                <textarea
                  id="smart-capture-raw-text"
                  value={rawText}
                  onChange={(event) => setRawText(event.target.value)}
                  placeholder="Dán tin nhắn Slack, Email hoặc biên bản họp vào đây để AI soạn bản nháp thẻ..."
                  disabled={isAnalyzing}
                  rows={15}
                  style={{
                    height: "370px",
                    minHeight: "300px",
                  }}
                  className="block w-full resize-none overflow-y-scroll rounded-xl border border-neutral-200 bg-neutral-50/60 p-4 text-sm leading-6 text-neutral-800 shadow-inner outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-200 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:opacity-70 styled-scrollbar"
                />
              </div>

              {isAnalyzing && (
                <div className="rounded-xl border border-violet-100 bg-violet-50/60 p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-medium text-violet-700">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    AI đang đọc nội dung và phân tích...
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
            <div className="grid min-h-0 gap-4 xl:grid-cols-[280px_minmax(0,1fr)_340px]">
              <section className="flex min-h-0 flex-col rounded-xl border border-neutral-200 bg-neutral-50/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <label className="inline-flex items-center gap-1.5 rounded-md bg-violet-50 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-violet-700">
                    <FileText className="h-3.5 w-3.5" />
                    Nguồn
                  </label>
                  <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-neutral-500 ring-1 ring-neutral-200">
                    {trimmedRawTextLength}/{SMART_CAPTURE_RAW_TEXT_MAX_LENGTH}
                  </span>
                </div>
                <div className="mt-3 rounded-lg border border-violet-100 bg-white px-3 py-3 text-sm leading-6 text-neutral-700">
                  <p className="font-semibold text-neutral-900">Cách AI xử lý</p>
                  <p className="mt-1 text-neutral-600">{splitSummary}</p>
                </div>
                <div className="mt-3 min-h-[180px] max-h-[260px] flex-1 overflow-y-auto whitespace-pre-wrap rounded-lg border border-neutral-200 bg-white px-3 py-3 text-sm leading-6 text-neutral-700 styled-scrollbar xl:max-h-[430px]">
                  {rawText}
                </div>
              </section>

              <section className="min-h-0 rounded-xl border border-neutral-200 bg-white p-4">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <label className="inline-flex items-center gap-1.5 rounded-md bg-violet-50 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-violet-700">
                    <Sparkles className="h-3.5 w-3.5" />
                    Bản nháp thẻ
                  </label>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={onToggleAllDrafts}
                      disabled={isCreating || drafts.length === 0}
                      className="h-8 rounded-lg border-neutral-200 text-xs"
                    >
                      {allDraftsSelected ? "Bỏ chọn tất cả" : "Chọn tất cả"}
                    </Button>
                    <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-600">
                      {selectedDraftCount}/{drafts.length} được chọn
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  {drafts.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50 p-6 text-center text-sm text-neutral-500">
                      Chưa có bản nháp thẻ.
                    </div>
                  ) : drafts.map((draft, index) => {
                    const isActive = activeDraft?.localId === draft.localId;

                    return (
                      <article
                        key={draft.localId}
                        className={cn(
                          "rounded-xl border bg-white p-3 transition",
                          isActive ? "border-violet-300 ring-2 ring-violet-100" : "border-neutral-200 hover:border-violet-200",
                          !draft.isSelected && "opacity-60",
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={draft.isSelected}
                            onChange={() => onToggleDraftSelection(draft.localId)}
                            disabled={isCreating}
                            className="mt-1 h-4 w-4 rounded border-neutral-300 accent-violet-600"
                            aria-label={`Chọn bản nháp ${index + 1}`}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setActiveDraftId(draft.localId);
                              setNewChecklistItem("");
                            }}
                            disabled={isCreating}
                            className="min-w-0 flex-1 text-left"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full bg-violet-50 px-2 py-0.5 text-xs font-bold text-violet-700">
                                #{index + 1}
                              </span>
                              <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-semibold text-neutral-600">
                                {getListTitle(draft.listId)}
                              </span>
                              <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-semibold text-neutral-600">
                                {formatDueDate(draft.dueDateIso)}
                              </span>
                            </div>
                            <h3 className="mt-2 line-clamp-2 text-sm font-semibold text-neutral-900">
                              {draft.title || "Chưa có tiêu đề"}
                            </h3>
                            <p className="mt-1 line-clamp-2 text-xs leading-5 text-neutral-500">
                              {draft.splitReason}
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                              <span>{draft.assigneeBoardMemberIds.length} người</span>
                              <span>{draft.labelIds.length} nhãn</span>
                              <span>{draft.selectedChecklistTitles.length}/{draft.checklistItems.length} checklist</span>
                            </div>
                          </button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => onDeleteDraft(draft.localId)}
                            disabled={isCreating || drafts.length <= 1}
                            className="h-8 w-8 shrink-0 rounded-lg p-0 text-neutral-400 hover:text-red-600"
                            aria-label={`Xóa bản nháp ${index + 1}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>

              <section className="space-y-4 rounded-xl border border-neutral-200 bg-neutral-50/70 p-4">
                {!activeDraft ? (
                  <div className="rounded-lg border border-dashed border-neutral-200 bg-white p-5 text-center text-sm text-neutral-500">
                    Chọn một bản nháp để chỉnh sửa.
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between gap-3">
                      <label className="inline-flex items-center gap-1.5 rounded-md bg-violet-50 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-violet-700">
                        <LayoutGrid className="h-3.5 w-3.5" />
                        Chi tiết bản nháp
                      </label>
                      <span className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-semibold",
                        activeDraft.isSelected ? "bg-emerald-50 text-emerald-700" : "bg-neutral-100 text-neutral-500",
                      )}>
                        {activeDraft.isSelected ? "Sẽ tạo" : "Bỏ qua"}
                      </span>
                    </div>

                    {activeDraft.sourceExcerpt && (
                      <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs leading-5 text-neutral-600">
                        <span className="font-semibold text-neutral-800">Nguồn: </span>
                        {activeDraft.sourceExcerpt}
                      </div>
                    )}

                    <div className="space-y-2">
                      <label htmlFor="smart-capture-title" className="inline-flex items-center gap-1.5 rounded-md bg-violet-50 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-violet-700">
                        <Type className="h-3.5 w-3.5" />
                        Tiêu đề
                      </label>
                      <Input
                        id="smart-capture-title"
                        value={activeDraft.title}
                        onChange={(event) => updateDraft(activeDraft.localId, "title", event.target.value)}
                        disabled={isCreating}
                        className="h-10 rounded-lg border-neutral-200 bg-white text-sm font-medium text-neutral-800 focus-visible:border-violet-500 focus-visible:ring-violet-200"
                      />
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="smart-capture-description" className="inline-flex items-center gap-1.5 rounded-md bg-violet-50 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-violet-700">
                        <AlignLeft className="h-3.5 w-3.5" />
                        Mô tả
                      </label>
                      <textarea
                        id="smart-capture-description"
                        value={activeDraft.description}
                        onChange={(event) => updateDraft(activeDraft.localId, "description", event.target.value)}
                        disabled={isCreating}
                        rows={8}
                        className="block h-[180px] w-full resize-none overflow-y-scroll rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-sm leading-6 font-medium text-neutral-800 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-200 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:opacity-70 styled-scrollbar"
                      />
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                      <div className="space-y-2">
                        <label htmlFor="smart-capture-list" className="inline-flex items-center gap-1.5 rounded-md bg-violet-50 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-violet-700">
                          <LayoutGrid className="h-3.5 w-3.5" />
                          Danh sách
                        </label>
                        <select
                          id="smart-capture-list"
                          value={activeDraft.listId}
                          onChange={(event) => updateDraft(activeDraft.localId, "listId", event.target.value)}
                          disabled={isCreating}
                          className="h-9 w-full rounded-lg border border-neutral-200 bg-white px-2.5 text-sm font-semibold text-neutral-800 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-200"
                        >
                          {lists.map((list) => (
                            <option key={list.id} value={list.id}>
                              {list.title}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label htmlFor="smart-capture-due-date" className="inline-flex items-center gap-1.5 rounded-md bg-violet-50 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-violet-700">
                          <Calendar className="h-3.5 w-3.5" />
                          Hạn chót
                        </label>
                        <Input
                          id="smart-capture-due-date"
                          type="datetime-local"
                          value={toDatetimeLocalValue(activeDraft.dueDateIso)}
                          onChange={(event) => updateDraft(activeDraft.localId, "dueDateIso", fromDatetimeLocalValue(event.target.value))}
                          disabled={isCreating}
                          className="h-9 rounded-lg border-neutral-200 bg-white text-sm font-semibold text-neutral-800 focus-visible:border-violet-500 focus-visible:ring-violet-200"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="inline-flex items-center gap-1.5 rounded-md bg-violet-50 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-violet-700">
                        <CheckSquare className="h-3.5 w-3.5" />
                        Checklist
                      </label>
                      {activeDraft.checklistItems.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-neutral-200 bg-white p-3 text-center text-sm text-neutral-400">
                          Chưa có đầu việc con.
                        </div>
                      ) : (
                        <div className="max-h-[170px] space-y-2 overflow-y-auto pr-1 styled-scrollbar">
                          {activeDraft.checklistItems.map((item, index) => (
                            <div key={`${activeDraft.localId}-${index}-${item}`} className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={activeDraft.selectedChecklistTitles.includes(item)}
                                onChange={() => onToggleChecklistItem(item)}
                                disabled={isCreating}
                                className="h-4 w-4 rounded border-neutral-300 accent-violet-600"
                                aria-label="Chọn checklist item"
                              />
                              <Input
                                value={item}
                                onChange={(event) => onChecklistItemChange(index, event.target.value)}
                                disabled={isCreating}
                                className={cn(
                                  "h-9 rounded-lg border-neutral-200 bg-white text-sm font-medium text-neutral-800 focus-visible:border-violet-500 focus-visible:ring-violet-200",
                                  !activeDraft.selectedChecklistTitles.includes(item) && "bg-neutral-100/60 text-neutral-400 line-through",
                                )}
                              />
                            </div>
                          ))}
                        </div>
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
                          disabled={isCreating || activeDraft.checklistItems.length >= 20}
                          placeholder="Thêm đầu việc..."
                          className="h-9 rounded-lg border-neutral-200 bg-white text-sm font-medium text-neutral-800 focus-visible:border-violet-500 focus-visible:ring-violet-200"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={onAddChecklistItem}
                          disabled={isCreating || activeDraft.checklistItems.length >= 20}
                          className="h-9 shrink-0 rounded-lg border-neutral-200"
                        >
                          <Plus className="h-4 w-4 text-neutral-600" />
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="inline-flex items-center gap-1.5 rounded-md bg-violet-50 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-violet-700">
                        <User className="h-3.5 w-3.5" />
                        Người thực hiện
                      </label>
                      {activeDraft.assigneeWarnings.length > 0 && (
                        <div className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                          {activeDraft.assigneeWarnings.map((warning) => (
                            <p key={warning}>{warning}</p>
                          ))}
                        </div>
                      )}
                      <div className="max-h-[140px] space-y-2 overflow-y-auto p-1 styled-scrollbar">
                        {assignableMembers.length === 0 ? (
                          <p className="rounded-lg border border-dashed border-neutral-200 bg-white p-3 text-xs text-neutral-400">
                            Bảng chưa có thành viên có thể được giao.
                          </p>
                        ) : assignableMembers.map((member) => {
                          const isSelected = activeDraft.assigneeBoardMemberIds.includes(member.id);
                          const isSuggested = suggestedAssigneeIds.has(member.id);

                          return (
                            <button
                              key={member.id}
                              type="button"
                              onClick={() => onToggleAssignee(member.id)}
                              disabled={isCreating}
                              className={cn(
                                "flex w-full items-center gap-2 rounded-lg border bg-white p-2 text-left text-xs transition hover:border-violet-300 hover:bg-violet-50/30 disabled:cursor-not-allowed disabled:opacity-60",
                                isSelected ? "border-violet-400 bg-violet-50 ring-2 ring-violet-100" : "border-neutral-200",
                              )}
                            >
                              <span className={cn(
                                "flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] font-bold",
                                isSelected ? "border-violet-600 bg-violet-600 text-white" : "border-neutral-300 bg-white text-transparent",
                              )}>
                                ✓
                              </span>
                              <span className="min-w-0 flex-1 truncate font-medium text-neutral-700">
                                {member.userName}
                              </span>
                              {isSuggested && <Bot className="h-3.5 w-3.5 shrink-0 text-violet-500" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="inline-flex items-center gap-1.5 rounded-md bg-violet-50 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-violet-700">
                        <Tag className="h-3.5 w-3.5" />
                        Nhãn công việc
                      </label>
                      <div className="max-h-[140px] space-y-2 overflow-y-auto p-1 styled-scrollbar">
                        {labels.length === 0 ? (
                          <p className="rounded-lg border border-dashed border-neutral-200 bg-white p-3 text-xs text-neutral-400">
                            Bảng chưa có nhãn.
                          </p>
                        ) : labels.map((label) => {
                          const isSelected = activeDraft.labelIds.includes(label.id);
                          const isSuggested = suggestedLabelIds.has(label.id);

                          return (
                            <button
                              key={label.id}
                              type="button"
                              onClick={() => onToggleLabel(label.id)}
                              disabled={isCreating}
                              className={cn(
                                "flex w-full items-center gap-2 rounded-lg border bg-white p-2 text-left text-xs transition hover:border-violet-300 disabled:cursor-not-allowed disabled:opacity-60",
                                isSelected
                                  ? "border-violet-500 bg-violet-50 ring-2 ring-violet-100"
                                  : isSuggested
                                    ? "border-dashed border-violet-300"
                                    : "border-neutral-200",
                              )}
                            >
                              <span className="h-4 w-4 shrink-0 rounded" style={{ backgroundColor: label.color }} />
                              <span className="min-w-0 flex-1 truncate font-semibold text-neutral-700">
                                {label.title || "Không tên"}
                              </span>
                              {isSuggested && <Bot className="h-3.5 w-3.5 shrink-0 text-violet-500" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </section>
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
                onClick={onCreateCards}
                disabled={isCreating || selectedDraftCount === 0 || selectedDrafts.some((draft) => !draft.title.trim() || !draft.listId)}
                className="rounded-lg bg-violet-600 text-white hover:bg-violet-700"
              >
                {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Tạo {selectedDraftCount} thẻ
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
