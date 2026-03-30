"use client";

import { useEffect, useMemo, useState } from "react";
import type { ComponentType } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CheckSquare,
  ChevronRight,
  Columns,
  File,
  FileText,
  Link2,
  ListChecks,
  Loader2,
  MessageSquare,
  Paperclip,
  Search,
  Text,
  User,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import { useCardModal } from "@/hooks/use-card-modal";
import { fetcher } from "@/lib/fetcher";
import { cn } from "@/lib/utils";
import type { BoardSearchResponse, BoardSearchResult } from "@/types";

interface BoardSearchProps {
  boardId: string;
}

const MIN_SEARCH_LENGTH = 1;

type BoardSearchSurfaceProps = BoardSearchProps & {
  compact?: boolean;
  onPick?: () => void;
};

const typeMeta = {
  card: {
    label: "Thẻ",
    icon: FileText,
    tone: "bg-sky-50 text-sky-700",
  },
  description: {
    label: "Mô tả",
    icon: Text,
    tone: "bg-violet-50 text-violet-700",
  },
  checklist: {
    label: "Checklist",
    icon: ListChecks,
    tone: "bg-amber-50 text-amber-700",
  },
  "checklist-item": {
    label: "Mục checklist",
    icon: CheckSquare,
    tone: "bg-amber-50 text-amber-700",
  },
  comment: {
    label: "Bình luận",
    icon: MessageSquare,
    tone: "bg-emerald-50 text-emerald-700",
  },
  attachment: {
    label: "Đính kèm",
    icon: Paperclip,
    tone: "bg-rose-50 text-rose-700",
  },
} satisfies Record<BoardSearchResult["type"], {
  label: string;
  icon: ComponentType<{ className?: string }>;
  tone: string;
}>;

const ResultBreadcrumbs = ({ item }: { item: BoardSearchResult }) => {
  const chevron = <ChevronRight className="mx-1 h-3 w-3 shrink-0 text-neutral-300" />;

  const listNode = (
    <span className="flex items-center gap-x-1 truncate max-w-[120px]" title={item.listTitle}>
      <Columns className="h-3 w-3 shrink-0 text-neutral-400" />
      <span className="truncate">{item.listTitle}</span>
    </span>
  );

  const cardNode = (
    <span className="flex items-center gap-x-1 truncate max-w-[140px] font-medium text-neutral-600" title={item.cardTitle}>
      <FileText className="h-3 w-3 shrink-0 text-neutral-400" />
      <span className="truncate">{item.cardTitle}</span>
    </span>
  );

  if (item.type === "card") {
    return (
      <div className="flex items-center text-xs font-medium text-neutral-500">
        {listNode}
      </div>
    );
  }

  if (item.type === "description") {
    return (
      <div className="flex items-center text-xs font-medium text-neutral-500">
        {listNode}
        {chevron}
        {cardNode}
      </div>
    );
  }

  if (item.type === "checklist") {
    return (
      <div className="flex items-center text-xs font-medium text-neutral-500">
        {listNode}
        {chevron}
        {cardNode}
      </div>
    );
  }

  if (item.type === "checklist-item") {
    return (
      <div className="flex items-center text-xs font-medium text-neutral-500">
        {listNode}
        {chevron}
        {cardNode}
        {chevron}
        <span className="flex items-center gap-x-1 truncate max-w-[120px]" title={item.checklistTitle}>
          <ListChecks className="h-3 w-3 shrink-0 text-neutral-400" />
          <span className="truncate">{item.checklistTitle}</span>
        </span>
      </div>
    );
  }

  if (item.type === "comment") {
    return (
      <div className="flex items-center text-xs font-medium text-neutral-500">
        {listNode}
        {chevron}
        {cardNode}
        {item.userName && (
          <>
            {chevron}
            <span className="flex items-center gap-x-1 truncate max-w-[100px] text-neutral-600" title={item.userName}>
              <User className="h-3 w-3 shrink-0 text-neutral-400" />
              <span className="truncate">{item.userName}</span>
            </span>
          </>
        )}
      </div>
    );
  }

  if (item.type === "attachment") {
    const isLink = item.attachmentType === "LINK";
    const AttachmentIcon = isLink ? Link2 : File;
    const label = isLink ? "Liên kết" : "Tệp";

    return (
      <div className="flex items-center text-xs font-medium text-neutral-500">
        {listNode}
        {chevron}
        {cardNode}
        {chevron}
        <span className="flex items-center gap-x-1 shrink-0 text-neutral-600">
          <AttachmentIcon className="h-3 w-3 shrink-0 text-neutral-400" />
          <span>{label}</span>
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center text-xs font-medium text-neutral-500">
      {listNode}
      {chevron}
      {cardNode}
    </div>
  );
};

const BoardSearchSurface = ({
  boardId,
  compact = false,
  onPick,
}: BoardSearchSurfaceProps) => {
  const cardModal = useCardModal();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const trimmedQuery = query.trim();
  const shouldSearch = debouncedQuery.trim().length >= MIN_SEARCH_LENGTH;

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedQuery(trimmedQuery);
    }, 220);

    return () => window.clearTimeout(timeout);
  }, [trimmedQuery]);

  const searchQuery = useQuery<BoardSearchResponse>({
    queryKey: ["board-search", boardId, debouncedQuery],
    queryFn: () =>
      fetcher(
        `/api/boards/${boardId}/search?q=${encodeURIComponent(debouncedQuery)}`,
      ),
    enabled: shouldSearch,
  });

  const items = searchQuery.data?.items ?? [];
  const isOpen = focused && trimmedQuery.length > 0;

  const statusLabel = useMemo(() => {
    if (trimmedQuery.length < MIN_SEARCH_LENGTH) {
      return "Nhập ít nhất 1 ký tự để tìm trong bảng.";
    }

    if (searchQuery.isLoading || debouncedQuery !== trimmedQuery) {
      return "Đang tìm...";
    }

    if (searchQuery.isError) {
      return "Không tải được kết quả tìm kiếm.";
    }

    if (items.length === 0) {
      return "Không có kết quả phù hợp.";
    }

    return null;
  }, [
    debouncedQuery,
    items.length,
    searchQuery.isError,
    searchQuery.isLoading,
    trimmedQuery,
  ]);

  const openResult = (item: BoardSearchResult) => {
    cardModal.onOpen(
      item.cardId,
      item.type === "checklist-item"
        ? { checklistItemId: item.checklistItemId }
        : undefined,
    );
    setFocused(false);
    onPick?.();
  };

  const searchInput = (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onFocus={() => setFocused(true)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setFocused(false);
          }
        }}
        placeholder="Tìm thẻ, checklist, bình luận, tệp..."
        className={cn(
          "h-9 rounded-lg border-neutral-200 bg-neutral-100 pl-9 pr-9 text-sm text-neutral-800 placeholder:text-neutral-400 focus-visible:border-violet-500 focus-visible:ring-1 focus-visible:ring-violet-200 focus-visible:bg-white transition-all font-medium",
          compact ? "w-full" : "w-[min(50vw,500px)]",
        )}
      />
      {query && (
        <button
          type="button"
          onClick={() => {
            setQuery("");
            setFocused(false);
          }}
          className="absolute right-2.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-md text-neutral-400 transition hover:bg-neutral-200 hover:text-neutral-700"
          aria-label="Xóa tìm kiếm"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );

  return (
    <Popover open={isOpen} onOpenChange={setFocused}>
      <PopoverAnchor asChild>
        {searchInput}
      </PopoverAnchor>
      <PopoverContent
        align="center"
        side="bottom"
        sideOffset={8}
        onOpenAutoFocus={(event) => event.preventDefault()}
        className={cn(
          "z-[60] max-h-[min(440px,calc(100vh-9rem))] overflow-hidden rounded-xl border border-neutral-200 bg-white p-0 text-neutral-900 shadow-2xl",
          compact ? "w-[calc(100vw-2rem)]" : "w-[min(55vw,560px)]",
        )}
      >
        <div className="border-b border-neutral-100 px-3 py-2">
          <p className="text-xs font-semibold text-neutral-500">
            Tìm trong bảng hiện tại
          </p>
        </div>
        {statusLabel ? (
          <div className="flex min-h-24 items-center justify-center px-4 py-6 text-center text-sm text-neutral-500">
            {(searchQuery.isLoading || debouncedQuery !== trimmedQuery) && trimmedQuery.length >= MIN_SEARCH_LENGTH ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin text-neutral-400" />
            ) : null}
            {statusLabel}
          </div>
        ) : (
          <div className="max-h-[360px] overflow-y-auto p-1.5 styled-scrollbar">
            {items.map((item) => {
              const meta = typeMeta[item.type];
              const Icon = meta.icon;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => openResult(item)}
                  className="flex w-full gap-x-3 rounded-lg px-2.5 py-2.5 text-left transition hover:bg-neutral-50 focus-visible:bg-neutral-50 focus-visible:outline-none"
                >
                  <div
                    className={cn(
                      "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                      meta.tone,
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-x-2">
                      <span className="shrink-0 rounded-md bg-neutral-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-neutral-500">
                        {meta.label}
                      </span>
                      <p className="truncate text-sm font-semibold text-neutral-900">
                        {item.title}
                      </p>
                      {item.isArchived ? (
                        <span className="shrink-0 rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                          Đã lưu trữ
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1">
                      <ResultBreadcrumbs item={item} />
                    </div>
                    {item.snippet && (
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-neutral-600">
                        {item.snippet}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};

export const BoardSearch = ({ boardId }: BoardSearchProps) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <div className="hidden md:block">
        <BoardSearchSurface boardId={boardId} />
      </div>
      <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
        <DialogTrigger asChild>
          <Button
            variant="ghost"
            className="h-8 w-8 p-0 text-neutral-600 hover:bg-neutral-100 hover:text-neutral-800 md:hidden"
            aria-label="Tìm trong bảng"
          >
            <Search className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent
          className="top-24 w-[calc(100%-2rem)] max-w-lg translate-y-0 border-neutral-200 bg-white p-3 text-neutral-900 shadow-xl"
          showCloseButton={false}
        >
          <DialogTitle className="sr-only">Tìm trong bảng</DialogTitle>
          <DialogDescription className="sr-only">
            Tìm thẻ, checklist, bình luận và tệp trong bảng hiện tại.
          </DialogDescription>
          <BoardSearchSurface
            boardId={boardId}
            compact
            onPick={() => setMobileOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
};
