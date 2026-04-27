"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Plus, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { fetcher } from "@/lib/fetcher";
import { cn } from "@/lib/utils";
import type {
  BoardSearchResponse,
  BoardSearchResult,
  CardWithList,
} from "@/types";

import {
  dependencyModeOptions,
  getCardResultTitle,
  getLinkedCardIds,
  MIN_SEARCH_LENGTH,
  type DependencyMode,
} from "./dependency-utils";

export const DependencySearchPicker = ({
  data,
  linkedBlockerIds,
  linkedBlockeeIds,
  isCreating,
  onCreateDependency,
}: {
  data: CardWithList;
  linkedBlockerIds: Set<string>;
  linkedBlockeeIds: Set<string>;
  isCreating: boolean;
  onCreateDependency: (input: {
    blockerCardId: string;
    blockedCardId: string;
  }) => void;
}) => {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<DependencyMode>("blocked-by");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const trimmedQuery = query.trim();
  const shouldSearch = open && debouncedQuery.trim().length >= MIN_SEARCH_LENGTH;

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedQuery(trimmedQuery);
    }, 220);

    return () => window.clearTimeout(timeout);
  }, [trimmedQuery]);

  useEffect(() => {
    if (open) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setQuery("");
      setDebouncedQuery("");
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [open]);

  const searchQuery = useQuery<BoardSearchResponse>({
    queryKey: ["board-search", data.list.boardId, debouncedQuery],
    queryFn: () =>
      fetcher(
        `/api/boards/${data.list.boardId}/search?q=${encodeURIComponent(debouncedQuery)}`,
      ),
    enabled: shouldSearch,
  });

  const excludedIds = useMemo(
    () => getLinkedCardIds({ linkedBlockerIds, linkedBlockeeIds }),
    [linkedBlockerIds, linkedBlockeeIds],
  );
  const cardResults = useMemo(
    () =>
      (searchQuery.data?.items ?? [])
        .filter((item): item is Extract<BoardSearchResult, { type: "card" }> =>
          item.type === "card" &&
          !item.isArchived &&
          item.cardId !== data.id &&
          !excludedIds.has(item.cardId),
        ),
    [data.id, excludedIds, searchQuery.data?.items],
  );

  const statusLabel = useMemo(() => {
    if (trimmedQuery.length < MIN_SEARCH_LENGTH) {
      return "Nhập tên thẻ để tìm.";
    }

    if (searchQuery.isLoading || debouncedQuery !== trimmedQuery) {
      return "Đang tìm...";
    }

    if (searchQuery.isError) {
      return "Không tải được kết quả.";
    }

    if (cardResults.length === 0) {
      return "Không có thẻ phù hợp.";
    }

    return null;
  }, [
    cardResults.length,
    debouncedQuery,
    searchQuery.isError,
    searchQuery.isLoading,
    trimmedQuery,
  ]);

  const onSelectCard = (cardId: string) => {
    onCreateDependency({
      blockerCardId: mode === "blocked-by" ? cardId : data.id,
      blockedCardId: mode === "blocked-by" ? data.id : cardId,
    });
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 bg-white text-neutral-700"
        >
          <Plus className="h-3.5 w-3.5" />
          Thêm phụ thuộc
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="bottom"
        sideOffset={8}
        onOpenAutoFocus={(event) => event.preventDefault()}
        className="w-86 max-w-[calc(100vw-2rem)] rounded-xl border border-neutral-200 bg-white p-3 shadow-xl"
      >
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-neutral-100 p-1">
          {dependencyModeOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setMode(option.value)}
              className={cn(
                "rounded-md px-2 py-1.5 text-xs font-semibold transition-colors",
                mode === option.value
                  ? "bg-white text-violet-700 shadow-xs"
                  : "text-neutral-600 hover:text-neutral-900",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm thẻ trong bảng..."
            disabled={isCreating}
            className="h-9 border-neutral-200 bg-neutral-50 pl-9 text-sm focus-visible:border-violet-400 focus-visible:ring-1 focus-visible:ring-violet-100"
          />
        </div>

        <div className="mt-3 max-h-64 overflow-y-auto styled-scrollbar">
          {statusLabel ? (
            <div className="flex min-h-20 items-center justify-center rounded-lg border border-dashed border-neutral-200 bg-neutral-50 px-3 py-4 text-center text-sm text-neutral-500">
              {(searchQuery.isLoading || debouncedQuery !== trimmedQuery) &&
              trimmedQuery.length >= MIN_SEARCH_LENGTH ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin text-neutral-400" />
              ) : null}
              {statusLabel}
            </div>
          ) : (
            <div className="space-y-1">
              {cardResults.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  disabled={isCreating}
                  onClick={() => onSelectCard(item.cardId)}
                  className="flex w-full min-w-0 flex-col rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-neutral-50 disabled:opacity-50"
                >
                  <span className="truncate text-sm font-semibold text-neutral-800">
                    {getCardResultTitle(item)}
                  </span>
                  <span className="mt-0.5 truncate text-xs text-neutral-500">
                    {item.listTitle}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
