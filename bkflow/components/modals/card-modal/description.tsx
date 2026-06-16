"use client";

import { toast } from "sonner";
import {
  AlignLeft,
  Bold,
  ChevronDown,
  Eye,
  Italic,
  Link2,
  List,
  Pencil,
  RefreshCw,
  Sparkles,
  Type,
  Underline,
} from "lucide-react";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useOnClickOutside } from "usehooks-ts";

import { useAction } from "@/hooks/use-action";
import { updateCard } from "@/actions/cards/update-card";
import { generateAiCardQuality } from "@/actions/ai/generate-ai-card-quality";
import { CardWithList } from "@/types";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { FormErrors } from "@/components/form/form-errors";
import { Hint } from "@/components/hint";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverDescription,
  PopoverTrigger,
} from "@/components/ui/popover";

import { patchBoardCardPreview, patchCardQueryData } from "./card-cache-utils";
import { MarkdownPreview } from "./markdown-preview";

interface DescriptionProps {
  data: CardWithList;
  canEdit?: boolean;
  getDescriptionBaseUpdatedAt: () => string | null;
  onDescriptionBaseUpdatedAtChange: (value: string) => void;
}

type MarkdownToolbarAction = "bold" | "italic" | "underline" | "bullet" | "link";
type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;
type HeadingOption = HeadingLevel | "normal";
type PreviewMode = "edit" | "preview";

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

const normalizeDescription = (value: string | null | undefined) => value ?? "";

const HEADING_OPTIONS: Array<{
  value: HeadingOption;
  label: string;
  previewClassName: string;
}> = [
  { value: "normal", label: "Văn bản bình thường", previewClassName: "text-sm font-normal" },
  { value: 1, label: "Heading 1", previewClassName: "text-2xl font-semibold" },
  { value: 2, label: "Heading 2", previewClassName: "text-xl font-semibold" },
  { value: 3, label: "Heading 3", previewClassName: "text-lg font-semibold" },
  { value: 4, label: "Heading 4", previewClassName: "text-base font-semibold" },
  { value: 5, label: "Heading 5", previewClassName: "text-sm font-semibold" },
  { value: 6, label: "Heading 6", previewClassName: "text-xs font-semibold text-neutral-500" },
];

const getSelectedLineRange = (value: string, selectionStart: number, selectionEnd: number) => {
  const normalizedEnd =
    selectionEnd > selectionStart && value[selectionEnd - 1] === "\n"
      ? selectionEnd - 1
      : selectionEnd;
  const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
  const lineEndIndex = value.indexOf("\n", normalizedEnd);
  const lineEnd = lineEndIndex === -1 ? value.length : lineEndIndex;

  return { lineStart, lineEnd };
};

const getLineStarts = (value: string, lineStart: number, lineEnd: number) => {
  const starts = [lineStart];

  for (let index = lineStart; index < lineEnd; index += 1) {
    if (value[index] === "\n" && index + 1 <= lineEnd) {
      starts.push(index + 1);
    }
  }

  return starts;
};

const transformSelectedLines = ({
  value,
  selectionStart,
  selectionEnd,
  transformLine,
  getSelectionAdjustment,
}: {
  value: string;
  selectionStart: number;
  selectionEnd: number;
  transformLine: (line: string) => string;
  getSelectionAdjustment: (lineStarts: number[]) => {
    startDelta: number;
    endDelta: number;
  };
}) => {
  const { lineStart, lineEnd } = getSelectedLineRange(value, selectionStart, selectionEnd);
  const lineStarts = getLineStarts(value, lineStart, lineEnd);
  const selectedLines = value.slice(lineStart, lineEnd).split("\n");
  const nextSelectedLines = selectedLines.map(transformLine);
  const nextValue = `${value.slice(0, lineStart)}${nextSelectedLines.join("\n")}${value.slice(lineEnd)}`;
  const { startDelta, endDelta } = getSelectionAdjustment(lineStarts);

  return {
    nextValue,
    nextSelectionStart: Math.max(lineStart, selectionStart + startDelta),
    nextSelectionEnd: Math.max(lineStart, selectionEnd + endDelta),
  };
};

const getOutdentSize = (line: string) => {
  if (line.startsWith("  ")) {
    return 2;
  }

  return line.startsWith(" ") ? 1 : 0;
};

const stripHeadingPrefix = (line: string) => line.replace(/^(\s*)#{1,6}\s+/, "$1");

export const Description = ({
  data,
  canEdit = true,
  getDescriptionBaseUpdatedAt,
  onDescriptionBaseUpdatedAtChange,
}: DescriptionProps) => {
  const queryClient = useQueryClient();

  const [isEditing, setIsEditing] = useState(false);
  const [isConflictOpen, setIsConflictOpen] = useState(false);
  const [draftDescription, setDraftDescription] = useState(() =>
    normalizeDescription(data.description),
  );
  const [previewMode, setPreviewMode] = useState<PreviewMode>("edit");

  const formRef = useRef<HTMLFormElement>(null!);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isEditing) {
      const nextTimestamp = toTimestampString(data.descriptionUpdatedAt);

      setDraftDescription(normalizeDescription(data.description));

      if (nextTimestamp && nextTimestamp !== getDescriptionBaseUpdatedAt()) {
        onDescriptionBaseUpdatedAtChange(nextTimestamp);
      }
    }
  }, [
    data.description,
    data.descriptionUpdatedAt,
    isEditing,
    getDescriptionBaseUpdatedAt,
    onDescriptionBaseUpdatedAtChange,
  ]);

  const descriptionRequestRef = useRef<{
    previous: string | null;
  } | null>(null);

  const enableEditing = () => {
    if (!canEdit) {
      return;
    }

    setIsConflictOpen(false);
    setDraftDescription(normalizeDescription(data.description));
    setPreviewMode("edit");
    setIsEditing(true);
    setTimeout(() => {
      textareaRef.current?.focus();
    });
  };

  const disableEditing = () => {
    setIsEditing(false);
    setDraftDescription(normalizeDescription(data.description));
    setPreviewMode("edit");
  };

  const onFormKeyDown = (event: ReactKeyboardEvent<HTMLFormElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      disableEditing();
    }
  };

  const updateTextareaSelection = (
    nextValue: string,
    nextSelectionStart: number,
    nextSelectionEnd = nextSelectionStart,
  ) => {
    setDraftDescription(nextValue);
    setTimeout(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(nextSelectionStart, nextSelectionEnd);
    }, 0);
  };

  const indentSelectedLines = () => {
    if (!textareaRef.current) {
      return;
    }

    const selectionStart = textareaRef.current.selectionStart;
    const selectionEnd = textareaRef.current.selectionEnd;

    if (selectionStart === selectionEnd) {
      updateTextareaSelection(
        `${draftDescription.slice(0, selectionStart)}  ${draftDescription.slice(selectionEnd)}`,
        selectionStart + 2,
      );
      return;
    }

    const result = transformSelectedLines({
      value: draftDescription,
      selectionStart,
      selectionEnd,
      transformLine: (line) => `  ${line}`,
      getSelectionAdjustment: (lineStarts) => ({
        startDelta: 2,
        endDelta: lineStarts.length * 2,
      }),
    });

    updateTextareaSelection(
      result.nextValue,
      result.nextSelectionStart,
      result.nextSelectionEnd,
    );
  };

  const outdentSelectedLines = () => {
    if (!textareaRef.current) {
      return;
    }

    const selectionStart = textareaRef.current.selectionStart;
    const selectionEnd = textareaRef.current.selectionEnd;
    const { lineStart, lineEnd } = getSelectedLineRange(
      draftDescription,
      selectionStart,
      selectionEnd,
    );
    const selectedLines = draftDescription.slice(lineStart, lineEnd).split("\n");
    const lineStarts = getLineStarts(draftDescription, lineStart, lineEnd);
    const removals = selectedLines.map(getOutdentSize);
    const nextSelectedLines = selectedLines.map((line, index) =>
      line.slice(removals[index]),
    );
    const nextValue = `${draftDescription.slice(0, lineStart)}${nextSelectedLines.join("\n")}${draftDescription.slice(lineEnd)}`;
    const startDelta = -removals
      .filter((_, index) => lineStarts[index] < selectionStart)
      .reduce<number>((total, removal) => total + removal, 0);
    const endDelta = -removals
      .filter((_, index) => lineStarts[index] < selectionEnd)
      .reduce<number>((total, removal) => total + removal, 0);
    const nextSelectionStart = Math.max(lineStart, selectionStart + startDelta);
    const nextSelectionEnd =
      selectionStart === selectionEnd
        ? nextSelectionStart
        : Math.max(lineStart, selectionEnd + endDelta);

    updateTextareaSelection(
      nextValue,
      nextSelectionStart,
      nextSelectionEnd,
    );
  };

  const applyLinePrefix = (prefix: string) => {
    if (!textareaRef.current) {
      return;
    }

    const selectionStart = textareaRef.current.selectionStart;
    const selectionEnd = textareaRef.current.selectionEnd;
    const result = transformSelectedLines({
      value: draftDescription,
      selectionStart,
      selectionEnd,
      transformLine: (line) => `${prefix}${line}`,
      getSelectionAdjustment: (lineStarts) => ({
        startDelta: prefix.length,
        endDelta: lineStarts.length * prefix.length,
      }),
    });

    updateTextareaSelection(
      result.nextValue,
      result.nextSelectionStart,
      result.nextSelectionEnd,
    );
  };

  const applyHeading = (heading: HeadingOption) => {
    if (!textareaRef.current) {
      return;
    }

    const selectionStart = textareaRef.current.selectionStart;
    const selectionEnd = textareaRef.current.selectionEnd;
    const { lineStart, lineEnd } = getSelectedLineRange(
      draftDescription,
      selectionStart,
      selectionEnd,
    );
    const selectedLines = draftDescription.slice(lineStart, lineEnd).split("\n");
    const lineStarts = getLineStarts(draftDescription, lineStart, lineEnd);
    const nextSelectedLines = selectedLines.map((line) => {
      const withoutHeading = stripHeadingPrefix(line);

      if (heading === "normal") {
        return withoutHeading;
      }

      const leadingWhitespace = withoutHeading.match(/^\s*/)?.[0] ?? "";
      const content = withoutHeading.slice(leadingWhitespace.length);

      return `${leadingWhitespace}${"#".repeat(heading)} ${content}`;
    });
    const diffs = nextSelectedLines.map(
      (line, index) => line.length - selectedLines[index].length,
    );
    const nextValue = `${draftDescription.slice(0, lineStart)}${nextSelectedLines.join("\n")}${draftDescription.slice(lineEnd)}`;
    const startDelta = diffs
      .filter((_, index) => lineStarts[index] <= selectionStart)
      .reduce((total, diff) => total + diff, 0);
    const endDelta = diffs
      .filter((_, index) => lineStarts[index] < selectionEnd)
      .reduce((total, diff) => total + diff, 0);
    const nextSelectionStart = Math.max(lineStart, selectionStart + startDelta);
    const nextSelectionEnd =
      selectionStart === selectionEnd
        ? nextSelectionStart
        : Math.max(lineStart, selectionEnd + endDelta);

    updateTextareaSelection(
      nextValue,
      nextSelectionStart,
      nextSelectionEnd,
    );
  };

  const insertMarkdown = (action: MarkdownToolbarAction) => {
    if (!textareaRef.current || isLoading) {
      return;
    }

    const textarea = textareaRef.current;
    const selectionStart = textarea.selectionStart;
    const selectionEnd = textarea.selectionEnd;
    const selectedText = draftDescription.slice(selectionStart, selectionEnd);
    let nextValue = draftDescription;
    let nextSelectionStart = selectionStart;
    let nextSelectionEnd = selectionEnd;

    const replaceSelection = (replacement: string, cursorOffset = replacement.length) => {
      nextValue = `${draftDescription.slice(0, selectionStart)}${replacement}${draftDescription.slice(selectionEnd)}`;
      nextSelectionStart = selectionStart + cursorOffset;
      nextSelectionEnd = nextSelectionStart;
    };

    if (action === "bold") {
      const fallback = selectedText || "text";
      replaceSelection(`**${fallback}**`, 2 + fallback.length);

      if (selectedText) {
        nextSelectionStart = selectionStart + 2;
        nextSelectionEnd = selectionEnd + 2;
      }
    } else if (action === "italic") {
      const fallback = selectedText || "text";
      replaceSelection(`*${fallback}*`, 1 + fallback.length);

      if (selectedText) {
        nextSelectionStart = selectionStart + 1;
        nextSelectionEnd = selectionEnd + 1;
      }
    } else if (action === "underline") {
      const fallback = selectedText || "text";
      replaceSelection(`++${fallback}++`, 2 + fallback.length);

      if (selectedText) {
        nextSelectionStart = selectionStart + 2;
        nextSelectionEnd = selectionEnd + 2;
      }
    } else if (action === "link") {
      const fallback = selectedText || "link";
      replaceSelection(`[${fallback}](https://example.com)`, 1 + fallback.length);

      if (selectedText) {
        nextSelectionStart = selectionStart + 1;
        nextSelectionEnd = selectionEnd + 1;
      }
    } else if (action === "bullet") {
      applyLinePrefix("- ");
      return;
    }

    updateTextareaSelection(nextValue, nextSelectionStart, nextSelectionEnd);
  };

  useOnClickOutside(formRef, (event) => {
    const target = event.target as HTMLElement;

    if (target.closest(".description-conflict-popover")) {
      return;
    }

    if (target.closest(".description-toolbar-popover")) {
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

  const [activeAiTask, setActiveAiTask] = useState<"create_description" | "rewrite_description" | null>(null);

  const { execute: executeGenerateAi, isLoading: isGeneratingAi } = useAction(generateAiCardQuality, {
    onSuccess: (resData) => {
      if (resData.description) {
        if (!isEditing) {
          setIsConflictOpen(false);
          setPreviewMode("edit");
          setIsEditing(true);
        }
        
        setDraftDescription(resData.description);
        
        setTimeout(() => {
          textareaRef.current?.focus();
        });
        
        toast.success("Đã tạo mô tả bằng AI!");
      }
      setActiveAiTask(null);
    },
    onError: (error) => {
      toast.error(error);
      setActiveAiTask(null);
    },
  });

  const handleGenerateAi = (task: "create_description" | "rewrite_description") => {
    setActiveAiTask(task);
    executeGenerateAi({
      boardId: data.list.boardId,
      cardId: data.id,
      task,
    });
  };

  const reloadCard = async () => {
    setIsConflictOpen(false);
    disableEditing();
    await queryClient.invalidateQueries({ queryKey: ["card", data.id] });
  };

  const onSubmit = () => {
    if (!canEdit || isLoading || descriptionRequestRef.current) {
      return;
    }

    const description = draftDescription;
    const boardId = data.list.boardId;
    const baseUpdatedAt =
      getDescriptionBaseUpdatedAt() ?? toTimestampString(data.descriptionUpdatedAt);

    if (description === normalizeDescription(data.description)) {
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

  const hasDescription = !!data.description?.trim();
  const isDraftChanged = draftDescription !== normalizeDescription(data.description);
  const toolbarItems: Array<{
    action: MarkdownToolbarAction;
    label: string;
    icon: ReactNode;
  }> = [
    { action: "bold", label: "In đậm", icon: <Bold className="h-3.5 w-3.5" /> },
    { action: "italic", label: "In nghiêng", icon: <Italic className="h-3.5 w-3.5" /> },
    { action: "underline", label: "Gạch chân", icon: <Underline className="h-3.5 w-3.5" /> },
    { action: "bullet", label: "Danh sách", icon: <List className="h-3.5 w-3.5" /> },
    { action: "link", label: "Liên kết", icon: <Link2 className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="flex items-start gap-x-4 w-full">
      <div className="w-10 h-10 rounded-xl bg-neutral-100 flex items-center justify-center flex-shrink-0 mt-0.5">
        <AlignLeft className="h-5 w-5 text-neutral-500" />
      </div>
      <Popover open={isConflictOpen} onOpenChange={setIsConflictOpen}>
        <PopoverAnchor asChild>
          <div className="w-full min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2.5">
              <p className="font-semibold text-base text-neutral-800">
                Mô tả
              </p>
              {canEdit && (
                <div className="flex items-center gap-x-1.5 ml-1">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleGenerateAi("create_description")}
                    disabled={isGeneratingAi || isLoading}
                    className="h-7 rounded-lg border-sky-100 bg-sky-50/50 px-2 text-xs font-semibold text-sky-700 hover:bg-sky-100 hover:text-sky-800 transition-colors shadow-xs"
                  >
                    {isGeneratingAi && activeAiTask === "create_description" ? (
                      <RefreshCw className="mr-1 h-3 w-3 animate-spin" />
                    ) : (
                      <Sparkles className="mr-1 h-3 w-3 text-sky-500" />
                    )}
                    {isGeneratingAi && activeAiTask === "create_description" ? "Đang tạo..." : "Tạo mô tả từ tiêu đề"}
                  </Button>
                  {hasDescription && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleGenerateAi("rewrite_description")}
                      disabled={isGeneratingAi || isLoading}
                      className="h-7 rounded-lg border-sky-100 bg-sky-50/50 px-2 text-xs font-semibold text-sky-700 hover:bg-sky-100 hover:text-sky-800 transition-colors shadow-xs"
                    >
                      {isGeneratingAi && activeAiTask === "rewrite_description" ? (
                        <RefreshCw className="mr-1 h-3 w-3 animate-spin" />
                      ) : (
                        <Sparkles className="mr-1 h-3 w-3 text-sky-500" />
                      )}
                      {isGeneratingAi && activeAiTask === "rewrite_description" ? "Đang viết lại..." : "Viết lại mô tả"}
                    </Button>
                  )}
                </div>
              )}
            </div>
            {isEditing ? (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  onSubmit();
                }}
                onKeyDown={onFormKeyDown}
                ref={formRef}
                className="space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-neutral-200 bg-neutral-50 p-1.5">
                  <div className="flex items-center gap-1">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={isLoading}
                          className="h-7 rounded-lg px-2 text-neutral-600 hover:bg-white hover:text-neutral-900"
                        >
                          <Type className="h-3.5 w-3.5" />
                          <ChevronDown className="h-3 w-3" />
                          <span className="sr-only">Kiểu văn bản</span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent
                        align="start"
                        side="bottom"
                        sideOffset={6}
                        className="description-toolbar-popover w-56 gap-0 p-1.5"
                      >
                        {HEADING_OPTIONS.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            disabled={isLoading}
                            onClick={() => applyHeading(option.value)}
                            className={cn(
                              "flex w-full items-center rounded-md px-3 py-2 text-left text-neutral-700 transition hover:bg-violet-50 hover:text-violet-700 disabled:opacity-50",
                              option.previewClassName,
                            )}
                          >
                            {option.label}
                          </button>
                        ))}
                      </PopoverContent>
                    </Popover>
                    <div className="mx-1 h-6 w-px bg-neutral-200" />
                    {toolbarItems.map((item) => (
                      <Hint key={item.action} description={item.label} side="top">
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          disabled={isLoading}
                          onClick={() => insertMarkdown(item.action)}
                          className="h-7 w-7 rounded-lg text-neutral-600 hover:bg-white hover:text-neutral-900"
                        >
                          {item.icon}
                          <span className="sr-only">{item.label}</span>
                        </Button>
                      </Hint>
                    ))}
                  </div>
                  <div className="flex items-center rounded-lg border border-neutral-200 bg-white p-0.5">
                    {(["edit", "preview"] as PreviewMode[]).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setPreviewMode(mode)}
                        disabled={isLoading}
                        className={cn(
                          "inline-flex h-7 items-center gap-1.5 rounded-md px-3 text-xs font-semibold transition disabled:opacity-50",
                          previewMode === mode
                            ? "bg-violet-600 text-white shadow-xs"
                            : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900",
                        )}
                      >
                        {mode === "edit" ? (
                          <Pencil className="h-3.5 w-3.5" />
                        ) : (
                          <Eye className="h-3.5 w-3.5" />
                        )}
                        {mode === "edit" ? "Viết" : "Xem trước"}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="w-full">
                  {previewMode === "edit" ? (
                    <div className="space-y-2">
                      <Textarea
                        id="description"
                        name="description"
                        ref={textareaRef}
                        value={draftDescription}
                        onChange={(event) => setDraftDescription(event.target.value)}
                        onKeyDown={(event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
                          if (event.key === "Tab") {
                            event.preventDefault();
                            if (event.shiftKey) {
                              outdentSelectedLines();
                            } else {
                              indentSelectedLines();
                            }
                            return;
                          }

                          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                            event.preventDefault();
                            formRef.current?.requestSubmit();
                          }
                        }}
                        disabled={isLoading}
                        placeholder="Thêm mô tả chi tiết hơn..."
                        aria-describedby="description-error"
                        className="min-h-[260px] w-full resize-y rounded-xl border-neutral-200 bg-white px-4 py-3.5 text-base leading-relaxed shadow-sm focus-visible:border-violet-400 focus-visible:ring-1 focus-visible:ring-violet-200"
                      />
                      <FormErrors id="description" errors={fieldErrors} />
                    </div>
                  ) : (
                    <div className="min-h-[260px] rounded-xl border border-neutral-200 bg-white px-4 py-3.5 text-base leading-relaxed shadow-sm">
                      <MarkdownPreview
                        value={draftDescription}
                        emptyText="Xem trước mô tả sẽ hiển thị ở đây."
                      />
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-x-2">
                  <Button
                    type="submit"
                    disabled={isLoading || !isDraftChanged}
                    size="sm"
                    className="h-9 rounded-lg bg-violet-600 px-5 text-sm text-white hover:bg-violet-700"
                  >
                    Lưu
                  </Button>
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
                tabIndex={canEdit ? 0 : undefined}
                onKeyDown={(event) => {
                  if (!canEdit) {
                    return;
                  }

                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    enableEditing();
                  }
                }}
                className={cn(
                  "min-h-[96px] rounded-xl px-4 py-3 text-base leading-relaxed transition-colors duration-150 md:text-base",
                  canEdit
                    ? "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-200"
                    : "cursor-default",
                  hasDescription
                    ? cn(
                      "border border-neutral-200 bg-neutral-50 text-neutral-700",
                      canEdit && "hover:bg-neutral-100",
                    )
                    : cn(
                      "border border-dashed border-neutral-200 bg-neutral-50 text-neutral-400",
                      canEdit && "hover:border-neutral-300 hover:bg-neutral-100",
                    ),
                )}
              >
                <MarkdownPreview
                  value={data.description}
                  emptyText={canEdit ? "Nhập để thêm mô tả..." : "Chưa có mô tả."}
                />
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
