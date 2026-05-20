"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Loader2, Plus, Search } from "lucide-react";

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
  BoardDependencyCandidateCard,
  BoardDependencyCandidatesResponse,
  CardWithList,
} from "@/types";

import {
  dependencyModeOptions,
  getLinkedCardIds,
  type DependencyMode,
} from "./dependency-utils";

type CandidateGroup = {
  listId: string;
  listTitle: string;
  cards: BoardDependencyCandidateCard[];
};

const normalizeSearch = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();

const CandidateRow = ({
  card,
  isCreating,
  onSelect,
}: {
  card: BoardDependencyCandidateCard;
  isCreating: boolean;
  onSelect: (cardId: string) => void;
}) => (
  <button
    type="button"
    disabled={isCreating}
    onClick={() => onSelect(card.id)}
    className="group flex w-full min-w-0 items-center justify-between gap-x-3 rounded-lg border border-transparent px-2.5 py-2 text-left transition-colors hover:border-neutral-200 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
  >
    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-neutral-800 group-hover:text-violet-700">
      {card.title}
    </span>
    {card.isCompleted ? (
      <span className="inline-flex shrink-0 items-center gap-x-1 rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700">
        <CheckCircle2 className="h-3 w-3" />
        Đã xong
      </span>
    ) : null}
  </button>
);

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
  const trimmedQuery = query.trim();
  const normalizedQuery = normalizeSearch(query);

  const candidatesQuery = useQuery<BoardDependencyCandidatesResponse>({
    queryKey: ["board-dependency-candidates", data.list.boardId],
    queryFn: () =>
      fetcher(`/api/boards/${data.list.boardId}/dependency-candidates`),
    enabled: open,
  });

  const excludedIds = useMemo(
    () => getLinkedCardIds({ linkedBlockerIds, linkedBlockeeIds }),
    [linkedBlockerIds, linkedBlockeeIds],
  );

  const { totalOtherCards, totalSelectableCards, visibleGroups } = useMemo(() => {
    const nextGroups: CandidateGroup[] = [];
    let nextTotalOtherCards = 0;
    let nextTotalSelectableCards = 0;

    (candidatesQuery.data?.lists ?? []).forEach((list) => {
      const selectableCards = list.cards.filter((card) => {
        if (card.id === data.id) {
          return false;
        }

        nextTotalOtherCards += 1;

        if (excludedIds.has(card.id)) {
          return false;
        }

        nextTotalSelectableCards += 1;

        if (!normalizedQuery) {
          return true;
        }

        return normalizeSearch(card.title).includes(normalizedQuery);
      });

      if (selectableCards.length > 0) {
        nextGroups.push({
          listId: list.listId,
          listTitle: list.listTitle,
          cards: selectableCards,
        });
      }
    });

    return {
      totalOtherCards: nextTotalOtherCards,
      totalSelectableCards: nextTotalSelectableCards,
      visibleGroups: nextGroups,
    };
  }, [candidatesQuery.data?.lists, data.id, excludedIds, normalizedQuery]);

  const emptyLabel = useMemo(() => {
    if (candidatesQuery.isLoading) {
      return "Đang tải danh sách thẻ...";
    }

    if (candidatesQuery.isError) {
      return "Không tải được danh sách thẻ.";
    }

    if (totalOtherCards === 0) {
      return "Bảng chưa có thẻ khác để liên kết.";
    }

    if (totalSelectableCards === 0) {
      return "Tất cả thẻ phù hợp đã được liên kết.";
    }

    if (trimmedQuery && visibleGroups.length === 0) {
      return "Không có thẻ phù hợp với từ khóa.";
    }

    return null;
  }, [
    candidatesQuery.isError,
    candidatesQuery.isLoading,
    totalOtherCards,
    totalSelectableCards,
    trimmedQuery,
    visibleGroups,
  ]);

  const onSelectCard = (cardId: string) => {
    onCreateDependency({
      blockerCardId: mode === "blocked-by" ? cardId : data.id,
      blockedCardId: mode === "blocked-by" ? data.id : cardId,
    });
    setOpen(false);
    setQuery("");
  };

  const onOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);

    if (!nextOpen) {
      setQuery("");
    }
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
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
        onWheel={(event) => event.stopPropagation()}
        onOpenAutoFocus={(event) => event.preventDefault()}
        className="w-96 max-w-[calc(100vw-2rem)] rounded-xl border border-neutral-200 bg-white p-3 shadow-xl"
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
            placeholder="Lọc thẻ trong bảng..."
            disabled={isCreating}
            className="h-9 border-neutral-200 bg-neutral-50 pl-9 text-sm focus-visible:border-violet-400 focus-visible:ring-1 focus-visible:ring-violet-100"
          />
        </div>

        <div
          className="mt-3 max-h-72 overflow-y-auto overscroll-contain styled-scrollbar"
          onWheel={(event) => event.stopPropagation()}
        >
          {emptyLabel ? (
            <div className="flex min-h-24 items-center justify-center rounded-lg border border-dashed border-neutral-200 bg-neutral-50 px-3 py-4 text-center text-sm text-neutral-500">
              {candidatesQuery.isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin text-neutral-400" />
              ) : null}
              {emptyLabel}
            </div>
          ) : (
            <div className="space-y-3">
              {visibleGroups.map((group) => (
                <section key={group.listId} className="space-y-1">
                  <div className="flex items-center justify-between gap-x-3 px-1">
                    <p className="truncate text-xs font-bold tracking-wide text-neutral-500">
                      {group.listTitle}
                    </p>
                    <span className="shrink-0 text-[11px] font-semibold text-neutral-400">
                      {group.cards.length}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {group.cards.map((card) => (
                      <CandidateRow
                        key={card.id}
                        card={card}
                        isCreating={isCreating}
                        onSelect={onSelectCard}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
