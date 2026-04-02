"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  GitBranch,
  Loader2,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { createCardDependency } from "@/actions/create-card-dependency";
import { deleteCardDependency } from "@/actions/delete-card-dependency";
import { Hint } from "@/components/hint";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useAction } from "@/hooks/use-action";
import { useCardModal } from "@/hooks/use-card-modal";
import { fetcher } from "@/lib/fetcher";
import { cn } from "@/lib/utils";
import type {
  BoardSearchResponse,
  BoardSearchResult,
  CardDependencyWithBlockedCard,
  CardDependencyWithBlockerCard,
  CardWithList,
} from "@/types";

type DependencyMode = "blocked-by" | "blocking";

type DependencyListItem =
  | {
      dependency: CardDependencyWithBlockerCard;
      relatedCard: CardDependencyWithBlockerCard["blockerCard"];
      status: "blocking-current";
    }
  | {
      dependency: CardDependencyWithBlockedCard;
      relatedCard: CardDependencyWithBlockedCard["blockedCard"];
      status: "blocked-by-current";
    };

interface CardDependenciesProps {
  data: CardWithList;
  canEdit?: boolean;
}

const MIN_SEARCH_LENGTH = 1;

const modeOptions = [
  {
    value: "blocked-by" as const,
    label: "Bị chặn bởi",
  },
  {
    value: "blocking" as const,
    label: "Chặn thẻ",
  },
];

const getCardResultTitle = (item: Extract<BoardSearchResult, { type: "card" }>) =>
  item.cardTitle || item.title;

const DependencyStatus = ({
  relatedCard,
  status,
}: Pick<DependencyListItem, "relatedCard" | "status">) => {
  if (relatedCard.archivedAt) {
    return (
      <span className="inline-flex items-center gap-x-1 rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700">
        <Archive className="h-3 w-3" />
        Đã lưu trữ
      </span>
    );
  }

  if (relatedCard.isCompleted) {
    return (
      <span className="inline-flex items-center gap-x-1 rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700">
        <CheckCircle2 className="h-3 w-3" />
        Hoàn thành
      </span>
    );
  }

  if (status === "blocking-current") {
    return (
      <span className="inline-flex items-center gap-x-1 rounded-md border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[11px] font-semibold text-rose-700">
        <AlertTriangle className="h-3 w-3" />
        Đang chặn
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-x-1 rounded-md border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 text-[11px] font-semibold text-neutral-600">
      <GitBranch className="h-3 w-3" />
      Đang bị chặn
    </span>
  );
};

const DependencyItem = ({
  item,
  canEdit,
  isDeleting,
  onDelete,
}: {
  item: DependencyListItem;
  canEdit: boolean;
  isDeleting: boolean;
  onDelete: (item: DependencyListItem) => void;
}) => {
  const cardModal = useCardModal();

  return (
    <li className="group flex items-center justify-between gap-x-3 rounded-lg border border-neutral-200 bg-white px-3 py-2 transition-colors hover:border-neutral-300 hover:bg-neutral-50">
      <button
        type="button"
        disabled={isDeleting}
        onClick={() => cardModal.onOpen(item.relatedCard.id)}
        className="min-w-0 flex-1 text-left disabled:cursor-not-allowed disabled:opacity-50"
      >
        <p className="truncate text-sm font-semibold text-neutral-800 group-hover:text-violet-700">
          {item.relatedCard.title}
        </p>
      </button>
      <div className="flex shrink-0 items-center gap-x-2">
        <DependencyStatus relatedCard={item.relatedCard} status={item.status} />
        {canEdit && (
          <Hint description="Gỡ liên kết phụ thuộc">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={isDeleting}
              onClick={() => onDelete(item)}
              className="h-7 w-7 text-neutral-400 hover:bg-rose-50 hover:text-rose-600"
              aria-label="Gỡ liên kết phụ thuộc"
            >
              {isDeleting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
            </Button>
          </Hint>
        )}
      </div>
    </li>
  );
};

const DependencySection = ({
  title,
  emptyLabel,
  items,
  canEdit,
  deletingDependencyId,
  onDelete,
}: {
  title: string;
  emptyLabel: string;
  items: DependencyListItem[];
  canEdit: boolean;
  deletingDependencyId: string | null;
  onDelete: (item: DependencyListItem) => void;
}) => (
  <div className="space-y-2">
    <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
      {title}
    </p>
    {items.length === 0 ? (
      <p className="rounded-lg border border-dashed border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-500">
        {emptyLabel}
      </p>
    ) : (
      <ul className="space-y-2">
        {items.map((item) => (
          <DependencyItem
            key={item.dependency.id}
            item={item}
            canEdit={canEdit}
            isDeleting={deletingDependencyId === item.dependency.id}
            onDelete={onDelete}
          />
        ))}
      </ul>
    )}
  </div>
);

const AddDependencyPopover = ({
  data,
  linkedBlockerIds,
  linkedBlockeeIds,
}: {
  data: CardWithList;
  linkedBlockerIds: Set<string>;
  linkedBlockeeIds: Set<string>;
}) => {
  const queryClient = useQueryClient();
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
    () => new Set([...linkedBlockerIds, ...linkedBlockeeIds]),
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

  const { execute: executeCreateDependency, isLoading } = useAction(createCardDependency, {
    onSuccess: (dependency) => {
      toast.success("Đã thêm liên kết phụ thuộc.");
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["card", data.id] });
      queryClient.invalidateQueries({ queryKey: ["card-logs", data.id] });
      queryClient.invalidateQueries({ queryKey: ["card", dependency.blockerCardId] });
      queryClient.invalidateQueries({ queryKey: ["card", dependency.blockedCardId] });
    },
    onError: (error) => toast.error(error),
  });

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
    executeCreateDependency({
      boardId: data.list.boardId,
      blockerCardId: mode === "blocked-by" ? cardId : data.id,
      blockedCardId: mode === "blocked-by" ? data.id : cardId,
    });
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
          {modeOptions.map((option) => (
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
            disabled={isLoading}
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
                  disabled={isLoading}
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

export const CardDependencies = ({
  data,
  canEdit = true,
}: CardDependenciesProps) => {
  const queryClient = useQueryClient();
  const [deletingDependencyId, setDeletingDependencyId] = useState<string | null>(null);

  const blockedByItems = data.blockedByDependencies.map((dependency) => ({
    dependency,
    relatedCard: dependency.blockerCard,
    status: "blocking-current" as const,
  }));
  const blockingItems = data.blockingDependencies.map((dependency) => ({
    dependency,
    relatedCard: dependency.blockedCard,
    status: "blocked-by-current" as const,
  }));
  const hasDependencies = blockedByItems.length > 0 || blockingItems.length > 0;
  const linkedBlockerIds = useMemo(
    () => new Set(data.blockedByDependencies.map((dependency) => dependency.blockerCardId)),
    [data.blockedByDependencies],
  );
  const linkedBlockeeIds = useMemo(
    () => new Set(data.blockingDependencies.map((dependency) => dependency.blockedCardId)),
    [data.blockingDependencies],
  );

  const { execute: executeDeleteDependency } = useAction(deleteCardDependency, {
    onSuccess: (dependency) => {
      toast.success("Đã gỡ liên kết phụ thuộc.");
      queryClient.invalidateQueries({ queryKey: ["card", data.id] });
      queryClient.invalidateQueries({ queryKey: ["card-logs", data.id] });
      queryClient.invalidateQueries({ queryKey: ["card", dependency.blockerCardId] });
      queryClient.invalidateQueries({ queryKey: ["card", dependency.blockedCardId] });
    },
    onError: (error) => toast.error(error),
    onComplete: () => setDeletingDependencyId(null),
  });

  const onDeleteDependency = (item: DependencyListItem) => {
    setDeletingDependencyId(item.dependency.id);
    executeDeleteDependency({
      boardId: data.list.boardId,
      dependencyId: item.dependency.id,
    });
  };

  if (!canEdit && !hasDependencies) {
    return null;
  }

  return (
    <div className="flex w-full items-start gap-x-4">
      <div className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-neutral-100">
        <GitBranch className="h-5 w-5 text-neutral-500" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-4 flex items-center justify-between gap-x-3">
          <p className="text-base font-semibold text-neutral-800">
            Phụ thuộc
          </p>
          {canEdit && (
            <AddDependencyPopover
              data={data}
              linkedBlockerIds={linkedBlockerIds}
              linkedBlockeeIds={linkedBlockeeIds}
            />
          )}
        </div>

        <div className="space-y-4">
          <DependencySection
            title="Đang bị chặn bởi"
            emptyLabel="Thẻ này chưa bị thẻ nào chặn."
            items={blockedByItems}
            canEdit={canEdit}
            deletingDependencyId={deletingDependencyId}
            onDelete={onDeleteDependency}
          />
          <DependencySection
            title="Đang chặn"
            emptyLabel="Thẻ này chưa chặn thẻ nào."
            items={blockingItems}
            canEdit={canEdit}
            deletingDependencyId={deletingDependencyId}
            onDelete={onDeleteDependency}
          />
        </div>
      </div>
    </div>
  );
};
