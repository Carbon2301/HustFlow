"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown } from "lucide-react";
import { toast } from "sonner";

import { copyCard } from "@/actions/copy-card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAction } from "@/hooks/use-action";
import { useBoardCalendarInvalidation } from "@/hooks/use-board-calendar-invalidation";
import { useCardModal } from "@/hooks/use-card-modal";
import { fetcher } from "@/lib/fetcher";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  PopoverClose,
} from "@/components/ui/popover";

type CopyOptionsResponse = {
  currentBoardId: string;
  currentListId: string;
  sourceCounts: {
    checklists: number;
    labels: number;
    members: number;
    attachments: number;
    comments: number;
  };
  organizations: {
    id: string;
    name: string;
    imageUrl?: string;
  }[];
  boards: {
    id: string;
    title: string;
    orgId: string;
    isCurrent: boolean;
    lists: {
      id: string;
      title: string;
      order: number;
      cardCount: number;
      isCurrent: boolean;
    }[];
  }[];
};

export type CopyCardDialogCard = {
  id: string;
  title: string;
  listId: string;
  list: {
    boardId: string;
  };
  checklists?: unknown[];
  labels?: unknown[];
  assignees?: unknown[];
  attachments?: unknown[];
  checklistProgress?: {
    total: number;
  };
  _count?: {
    comments: number;
    attachments: number;
  };
};

type CopyCardDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: CopyCardDialogCard;
  triggerRect?: DOMRect | null;
};

const selectClassName =
  "h-9 w-full appearance-none rounded-md border border-neutral-300 bg-white px-3 pr-8 text-sm text-neutral-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-400 truncate";

const getFallbackCounts = (data: CopyCardDialogCard) => ({
  checklists: data.checklists?.length ?? (data.checklistProgress?.total ? 1 : 0),
  labels: data.labels?.length ?? 0,
  members: data.assignees?.length ?? 0,
  attachments: data.attachments?.length ?? data._count?.attachments ?? 0,
  comments: data._count?.comments ?? 0,
});

export const CopyCardDialog = ({
  open,
  onOpenChange,
  data,
  triggerRect,
}: CopyCardDialogProps) => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const cardModal = useCardModal();
  const sourceBoardId = data.list.boardId;
  const invalidateSourceCalendar = useBoardCalendarInvalidation(sourceBoardId);
  const fallbackCounts = getFallbackCounts(data);
  const [title, setTitle] = useState(data.title);
  const [selectedBoardId, setSelectedBoardId] = useState(sourceBoardId);
  const [selectedListId, setSelectedListId] = useState(data.listId);
  const [position, setPosition] = useState(1);
  const [keepChecklists, setKeepChecklists] = useState(fallbackCounts.checklists > 0);
  const [keepLabels, setKeepLabels] = useState(fallbackCounts.labels > 0);
  const [keepMembers, setKeepMembers] = useState(fallbackCounts.members > 0);
  const [keepAttachments, setKeepAttachments] = useState(fallbackCounts.attachments > 0);
  const [keepComments, setKeepComments] = useState(fallbackCounts.comments > 0);

  const { data: options, isLoading: isLoadingOptions } = useQuery<CopyOptionsResponse>({
    queryKey: ["card-copy-options", data.id],
    queryFn: () => fetcher(`/api/cards/${data.id}/copy-options`),
    enabled: open,
  });

  const sourceCounts = options?.sourceCounts ?? fallbackCounts;

  const organizationById = useMemo(
    () => new Map((options?.organizations ?? []).map((organization) => [organization.id, organization])),
    [options?.organizations],
  );

  const selectedBoard = useMemo(
    () => options?.boards.find((board) => board.id === selectedBoardId) ?? null,
    [options?.boards, selectedBoardId],
  );

  const selectedList = useMemo(
    () => selectedBoard?.lists.find((list) => list.id === selectedListId) ?? null,
    [selectedBoard?.lists, selectedListId],
  );

  const positionOptions = useMemo(() => {
    const count = selectedList?.cardCount ?? 0;

    return Array.from({ length: count + 1 }, (_, index) => index + 1);
  }, [selectedList?.cardCount]);

  const { execute: executeCopyCard, isLoading: isSubmitting } = useAction(copyCard, {
    onSuccess: (createdCard) => {
      toast.success(`Đã tạo thẻ "${createdCard.title}"`);
      queryClient.invalidateQueries({ queryKey: ["card-copy-options", data.id] });
      queryClient.invalidateQueries({ queryKey: ["card", data.id] });
      queryClient.invalidateQueries({ queryKey: ["card-logs", data.id] });
      invalidateSourceCalendar();
      router.refresh();
      onOpenChange(false);
      if (selectedBoardId !== sourceBoardId) {
        cardModal.onClose();
      }
    },
    onError: (error) => {
      toast.error(error);
    },
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    const counts = options?.sourceCounts ?? getFallbackCounts(data);

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTitle(data.title);
    setKeepChecklists(counts.checklists > 0);
    setKeepLabels(counts.labels > 0);
    setKeepMembers(counts.members > 0);
    setKeepAttachments(counts.attachments > 0);
    setKeepComments(counts.comments > 0);
  }, [data, open, options?.sourceCounts]);

  useEffect(() => {
    if (!open || !options) {
      return;
    }

    const currentBoard = options.boards.find((board) => board.id === options.currentBoardId);
    const fallbackBoard = currentBoard ?? options.boards[0];

    if (!fallbackBoard) {
      return;
    }

    const currentList = fallbackBoard.lists.find((list) => list.id === options.currentListId);
    const fallbackList = currentList ?? fallbackBoard.lists[0];

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedBoardId(fallbackBoard.id);
    setSelectedListId(fallbackList?.id ?? "");
    setPosition((fallbackList?.cardCount ?? 0) + 1);
  }, [open, options]);

  const onBoardChange = (boardId: string) => {
    const nextBoard = options?.boards.find((board) => board.id === boardId);
    const nextList = nextBoard?.isCurrent
      ? nextBoard.lists.find((list) => list.isCurrent) ?? nextBoard.lists[0]
      : nextBoard?.lists[0];

    setSelectedBoardId(boardId);
    setSelectedListId(nextList?.id ?? "");
    setPosition((nextList?.cardCount ?? 0) + 1);
  };

  const onListChange = (listId: string) => {
    const nextList = selectedBoard?.lists.find((list) => list.id === listId);

    setSelectedListId(listId);
    setPosition((nextList?.cardCount ?? 0) + 1);
  };

  const onSubmit = () => {
    if (!selectedBoard || !selectedList || title.trim().length === 0) {
      return;
    }

    executeCopyCard({
      id: data.id,
      sourceBoardId,
      targetBoardId: selectedBoard.id,
      targetListId: selectedList.id,
      title: title.trim(),
      position,
      keepChecklists,
      keepLabels,
      keepMembers,
      keepAttachments,
      keepComments,
    });
  };

  const currentBoardOrganization = selectedBoard
    ? organizationById.get(selectedBoard.orgId)
    : null;
  const modalStyle = useMemo(() => {
    if (!triggerRect) return undefined;

    const modalWidth = 340;
    const gap = 8;
    const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1200;
    const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 800;

    let left = triggerRect.right + gap;
    if (left + modalWidth > viewportWidth) {
      left = triggerRect.left - modalWidth - gap;
    }
    left = Math.max(8, Math.min(left, viewportWidth - modalWidth - 8));

    let top = triggerRect.top;
    const estimatedHeight = 520;
    if (top + estimatedHeight > viewportHeight) {
      top = viewportHeight - estimatedHeight - 16;
    }
    top = Math.max(8, top);

    const maxHeight = viewportHeight - top - 16;

    return {
      position: "fixed" as const,
      top: `${top}px`,
      left: `${left}px`,
      width: `${modalWidth}px`,
      maxHeight: `${maxHeight}px`,
    };
  }, [triggerRect]);

  const canSubmit =
    title.trim().length > 0 &&
    Boolean(selectedBoard) &&
    Boolean(selectedList) &&
    !isLoadingOptions &&
    !isSubmitting;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onOpenAutoFocus={(event) => event.preventDefault()}
        style={modalStyle}
        className={cn(
          "w-[calc(100%-2rem)] max-h-[calc(100vh-2rem)] overflow-y-auto rounded-md border border-neutral-200 bg-white p-0 text-neutral-900 shadow-2xl styled-scrollbar z-[200]",
          triggerRect
            ? "top-auto left-auto translate-x-0 translate-y-0 fixed w-[340px] sm:max-w-[340px]"
            : "left-[50%] top-[50%] -translate-x-[50%] -translate-y-[50%] max-w-[340px]"
        )}
      >
        <DialogTitle className="px-6 pt-4 text-center text-base font-bold text-neutral-600">
          Sao chép thẻ
        </DialogTitle>
        <DialogDescription className="sr-only">
          Chọn nội dung giữ lại và vị trí tạo thẻ được sao chép.
        </DialogDescription>

        <div className="space-y-4 px-4 pb-4 pt-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500" htmlFor="copy-card-title">
              Tên
            </label>
            <textarea
              id="copy-card-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="min-h-20 w-full resize-none rounded-md border border-neutral-400 bg-white px-3 py-2 text-sm text-neutral-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">Giữ...</p>
            <div className="space-y-1.5">
              <KeepOption
                checked={keepChecklists}
                count={sourceCounts.checklists}
                disabled={sourceCounts.checklists === 0}
                label="Danh sách công việc"
                onChange={setKeepChecklists}
              />
              <KeepOption
                checked={keepLabels}
                count={sourceCounts.labels}
                disabled={sourceCounts.labels === 0}
                label="Nhãn"
                onChange={setKeepLabels}
              />
              <KeepOption
                checked={keepMembers}
                count={sourceCounts.members}
                disabled={sourceCounts.members === 0}
                label="Thành viên"
                onChange={setKeepMembers}
              />
              <KeepOption
                checked={keepAttachments}
                count={sourceCounts.attachments}
                disabled={sourceCounts.attachments === 0}
                label="Tệp đính kèm"
                onChange={setKeepAttachments}
              />
              <KeepOption
                checked={keepComments}
                count={sourceCounts.comments}
                disabled={sourceCounts.comments === 0}
                label="Nhận xét"
                onChange={setKeepComments}
              />
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">Sao chép tới...</p>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500" htmlFor="copy-card-board">
                Bảng thông tin
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    id="copy-card-board"
                    disabled={isLoadingOptions || (options?.boards.length ?? 0) === 0}
                    className={cn(
                      selectClassName,
                      "flex items-center justify-between text-left font-normal cursor-pointer select-none relative pr-8"
                    )}
                  >
                    <span className="truncate">
                      {selectedBoard ? (
                        <>
                          {selectedBoard.title}
                          {selectedBoard.isCurrent && " (hiện tại)"}
                        </>
                      ) : (
                        "Chọn bảng..."
                      )}
                    </span>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600" />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-[var(--radix-popover-trigger-width)] p-1 max-h-[220px] overflow-y-auto styled-scrollbar bg-white rounded-md border border-neutral-200 shadow-lg z-[9999]"
                  align="start"
                  onWheel={(e) => e.stopPropagation()}
                  onTouchMove={(e) => e.stopPropagation()}
                >
                  <div className="flex flex-col gap-y-0.5">
                    {(options?.boards ?? []).map((board) => {
                      const organization = organizationById.get(board.orgId);
                      const isSelected = board.id === selectedBoardId;

                      return (
                        <PopoverClose asChild key={board.id}>
                          <button
                            onClick={() => onBoardChange(board.id)}
                            className={cn(
                              "w-full text-left rounded-md py-1.5 px-2.5 text-sm transition-colors duration-150 whitespace-normal break-words cursor-pointer hover:bg-neutral-100",
                              isSelected && "bg-blue-50/70 hover:bg-blue-50 text-blue-600 font-semibold"
                            )}
                          >
                            <div className="leading-snug">{board.title}</div>
                            <div className="text-[11px] text-neutral-500 font-normal mt-0.5 leading-tight">
                              {organization ? `${organization.name}` : ""}
                              {board.isCurrent && " (hiện tại)"}
                            </div>
                          </button>
                        </PopoverClose>
                      );
                    })}
                  </div>
                </PopoverContent>
              </Popover>
              {!selectedBoard?.isCurrent && currentBoardOrganization ? (
                <p className="text-xs text-neutral-500 truncate" title={currentBoardOrganization.name}>
                  {currentBoardOrganization.name}
                </p>
              ) : null}
            </div>

            <div className="grid grid-cols-[minmax(0,1fr)_80px] gap-2">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500" htmlFor="copy-card-list">
                  Danh sách
                </label>
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      id="copy-card-list"
                      disabled={isLoadingOptions || !selectedBoard || selectedBoard.lists.length === 0}
                      className={cn(
                        selectClassName,
                        "flex items-center justify-between text-left font-normal cursor-pointer select-none relative pr-8"
                      )}
                    >
                      <span className="truncate">
                        {selectedList ? (
                          <>
                            {selectedList.title}
                            {selectedList.isCurrent && " (hiện tại)"}
                          </>
                        ) : (
                          "Chọn danh sách..."
                        )}
                      </span>
                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-[var(--radix-popover-trigger-width)] p-1 max-h-[220px] overflow-y-auto styled-scrollbar bg-white rounded-md border border-neutral-200 shadow-lg z-[9999]"
                    align="start"
                    onWheel={(e) => e.stopPropagation()}
                    onTouchMove={(e) => e.stopPropagation()}
                  >
                    <div className="flex flex-col gap-y-0.5">
                      {(selectedBoard?.lists ?? []).map((list) => {
                        const isSelected = list.id === selectedListId;

                        return (
                          <PopoverClose asChild key={list.id}>
                            <button
                              onClick={() => onListChange(list.id)}
                              className={cn(
                                "w-full text-left rounded-md py-1.5 px-2.5 text-sm transition-colors duration-150 whitespace-normal break-words cursor-pointer hover:bg-neutral-100",
                                isSelected && "bg-blue-50/70 hover:bg-blue-50 text-blue-600 font-semibold"
                              )}
                            >
                              <div className="leading-snug">{list.title}</div>
                              {list.isCurrent && (
                                <div className="text-[11px] text-blue-500 font-normal mt-0.5 leading-tight">
                                  (hiện tại)
                                </div>
                              )}
                            </button>
                          </PopoverClose>
                        );
                      })}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500" htmlFor="copy-card-position">
                  Vị trí
                </label>
                <SelectShell>
                  <select
                    id="copy-card-position"
                    value={position}
                    onChange={(event) => setPosition(Number(event.target.value))}
                    disabled={isLoadingOptions || !selectedList}
                    className={selectClassName}
                    title={String(position)}
                  >
                    {positionOptions.map((positionOption) => (
                      <option key={positionOption} value={positionOption}>
                        {positionOption}
                      </option>
                    ))}
                  </select>
                </SelectShell>
              </div>
            </div>
          </div>

          <Button
            type="button"
            onClick={onSubmit}
            disabled={!canSubmit}
            className="h-9 w-full rounded-md bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700"
          >
            {isSubmitting ? "Đang tạo..." : "Tạo thẻ"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const SelectShell = ({ children }: { children: ReactNode }) => (
  <div className="relative">
    {children}
    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600" />
  </div>
);

const KeepOption = ({
  checked,
  count,
  disabled,
  label,
  onChange,
}: {
  checked: boolean;
  count: number;
  disabled: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) => (
  <label
    className={cn(
      "flex items-center gap-2 text-sm text-neutral-600",
      disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
    )}
  >
    <span className="relative flex h-4 w-4 shrink-0 items-center justify-center">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="peer h-4 w-4 appearance-none rounded border border-neutral-300 bg-white checked:border-blue-600 checked:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
      />
      <Check className="pointer-events-none absolute h-3 w-3 text-white opacity-0 peer-checked:opacity-100" />
    </span>
    <span>
      {label} ({count})
    </span>
  </label>
);
