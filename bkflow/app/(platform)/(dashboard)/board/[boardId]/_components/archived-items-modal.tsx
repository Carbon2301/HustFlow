"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, ChevronLeft, Loader2, RotateCcw, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { deleteArchivedCard } from "@/actions/delete-archived-card";
import { deleteArchivedList } from "@/actions/delete-archived-list";
import { restoreCard } from "@/actions/restore-card";
import { restoreList } from "@/actions/restore-list";
import { Button } from "@/components/ui/button";
import {
  DialogTitle,
} from "@/components/ui/dialog";
import { Dialog as DialogPrimitive } from "radix-ui";
import { Input } from "@/components/ui/input";
import { useAction } from "@/hooks/use-action";
import { cn } from "@/lib/utils";
import { ConfirmModal } from "@/components/modals/confirm-modal";

type ArchivedItemType = "lists" | "cards";

type ArchivedListItem = {
  id: string;
  title: string;
  boardId: string;
  archivedAt: string | null;
  _count?: {
    cards: number;
  };
};

type ArchivedCardItem = {
  id: string;
  title: string;
  boardId: string;
  listId: string;
  listTitle: string;
  archivedAt: string | null;
  listArchivedAt: string | null;
};

type ArchivedResponse<T> = {
  items: T[];
};

interface ArchivedItemsModalProps {
  boardId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const itemTypeLabels: Record<ArchivedItemType, string> = {
  lists: "Danh sách",
  cards: "Thẻ",
};

export const ArchivedItemsModal = ({
  boardId,
  open,
  onOpenChange,
}: ArchivedItemsModalProps) => {
  const router = useRouter();
  const [type, setType] = useState<ArchivedItemType>("lists");
  const [query, setQuery] = useState("");
  const [lists, setLists] = useState<ArchivedListItem[]>([]);
  const [cards, setCards] = useState<ArchivedCardItem[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [pendingItemId, setPendingItemId] = useState<string | null>(null);

  const alternateType = type === "lists" ? "cards" : "lists";

  const loadArchivedItems = useCallback(async () => {
    if (!open) {
      return;
    }

    setIsFetching(true);
    setFetchError(null);

    try {
      const params = new URLSearchParams({
        type,
      });

      const trimmedQuery = query.trim();

      if (trimmedQuery) {
        params.set("q", trimmedQuery);
      }

      const response = await fetch(`/api/boards/${boardId}/archived?${params.toString()}`);

      if (!response.ok) {
        throw new Error("Không thể tải mục đã lưu trữ.");
      }

      if (type === "lists") {
        const data = await response.json() as ArchivedResponse<ArchivedListItem>;
        setLists(data.items);
      } else {
        const data = await response.json() as ArchivedResponse<ArchivedCardItem>;
        setCards(data.items);
      }
    } catch (error) {
      setFetchError(error instanceof Error ? error.message : "Không thể tải mục đã lưu trữ.");
    } finally {
      setIsFetching(false);
    }
  }, [boardId, open, query, type]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const timeout = window.setTimeout(() => {
      void loadArchivedItems();
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [loadArchivedItems, open]);

  const refreshAfterMutation = useCallback(() => {
    void loadArchivedItems();
    router.refresh();
  }, [loadArchivedItems, router]);

  const { execute: executeRestoreList, isLoading: isRestoringList } = useAction(restoreList, {
    onSuccess: (list) => {
      toast.success(`Đã khôi phục danh sách "${list.title}"`);
      refreshAfterMutation();
    },
    onError: (error) => {
      toast.error(error);
    },
    onComplete: () => {
      setPendingItemId(null);
    },
  });

  const { execute: executeDeleteList, isLoading: isDeletingList } = useAction(deleteArchivedList, {
    onSuccess: (list) => {
      toast.success(`Đã xóa vĩnh viễn danh sách "${list.title}"`);
      refreshAfterMutation();
    },
    onError: (error) => {
      toast.error(error);
    },
    onComplete: () => {
      setPendingItemId(null);
    },
  });

  const { execute: executeRestoreCard, isLoading: isRestoringCard } = useAction(restoreCard, {
    onSuccess: (card) => {
      toast.success(`Đã khôi phục thẻ "${card.title}"`);
      refreshAfterMutation();
    },
    onError: (error) => {
      toast.error(error);
    },
    onComplete: () => {
      setPendingItemId(null);
    },
  });

  const { execute: executeDeleteCard, isLoading: isDeletingCard } = useAction(deleteArchivedCard, {
    onSuccess: (card) => {
      toast.success(`Đã xóa vĩnh viễn thẻ "${card.title}"`);
      refreshAfterMutation();
    },
    onError: (error) => {
      toast.error(error);
    },
    onComplete: () => {
      setPendingItemId(null);
    },
  });

  const isMutating = isRestoringList || isDeletingList || isRestoringCard || isDeletingCard;

  const visibleItems = useMemo(
    () => type === "lists" ? lists : cards,
    [cards, lists, type],
  );

  const onRestoreList = (item: ArchivedListItem) => {
    if (isMutating) {
      return;
    }

    setPendingItemId(item.id);
    executeRestoreList({ id: item.id, boardId });
  };

  const onRestoreCard = (item: ArchivedCardItem) => {
    if (isMutating) {
      return;
    }

    setPendingItemId(item.id);
    executeRestoreCard({ id: item.id, boardId });
  };

  const renderLoadingText = (action: "restore" | "delete") =>
    action === "restore" ? "Đang khôi phục…" : "Đang xóa…";

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange} modal={false}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Content
          onOpenAutoFocus={(event) => event.preventDefault()}
          onFocusOutside={(event) => event.preventDefault()}
          onPointerDownOutside={(event) => {
            const target = event.target as HTMLElement;
            if (
              target.closest("#archived-items-trigger") || 
              target.closest("[data-role='popover-content']")
            ) {
              event.preventDefault();
            }
          }}
          className="fixed top-[60px] right-4 z-50 flex w-[calc(100vw-32px)] max-w-[400px] flex-col gap-0 overflow-hidden rounded-xl border border-neutral-200 bg-white text-neutral-800 shadow-2xl outline-none duration-150 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
        >
        <div className="flex h-12 items-center border-b border-neutral-100 px-2">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="h-8 w-8 text-neutral-500 hover:bg-neutral-100"
            onClick={() => onOpenChange(false)}
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="sr-only">Đóng</span>
          </Button>
          <DialogTitle className="flex-1 text-center text-sm font-semibold text-neutral-700">
            Mục đã lưu trữ
          </DialogTitle>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="h-8 w-8 text-neutral-500 hover:bg-neutral-100"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Đóng</span>
          </Button>
        </div>

        <div className="flex flex-col gap-2 border-b border-neutral-100 p-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm kiếm"
              className="h-9 pl-8"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            className="h-9 shrink-0 justify-center gap-x-2 px-3 text-sm"
            onClick={() => setType(alternateType)}
            disabled={isMutating}
          >
            Chuyển sang {itemTypeLabels[alternateType].toLowerCase()}
          </Button>
        </div>

        <div className="max-h-[60vh] min-h-[260px] overflow-y-auto p-3">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-semibold text-neutral-700">
              {itemTypeLabels[type]}
            </div>
            {isFetching && (
              <div className="flex items-center gap-x-1.5 text-xs text-neutral-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Đang tải
              </div>
            )}
          </div>

          {fetchError ? (
            <div className="rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-600">
              {fetchError}
            </div>
          ) : null}

          {!fetchError && !isFetching && visibleItems.length === 0 ? (
            <div className="flex min-h-[180px] items-center justify-center rounded-lg border border-dashed border-neutral-200 bg-neutral-50/70 px-4 text-center text-sm text-neutral-500">
              {type === "lists"
                ? "Không có danh sách đã lưu trữ."
                : "Không có thẻ đã lưu trữ."}
            </div>
          ) : null}

          {!fetchError && visibleItems.length > 0 ? (
            <div className="space-y-3">
              {type === "lists"
                ? lists.map((item) => {
                    const isPending = pendingItemId === item.id;

                    return (
                      <div
                        key={item.id}
                        className="rounded-lg border border-neutral-200 bg-white p-3 shadow-sm"
                      >
                        <div className="min-w-0">
                          <div className="break-words text-sm font-semibold text-neutral-800">
                            {item.title}
                          </div>
                          <div className="mt-1 flex items-center gap-x-1.5 text-xs text-neutral-500">
                            <Archive className="h-3.5 w-3.5" />
                            Đã lưu trữ
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8 gap-x-1.5"
                            disabled={isMutating}
                            onClick={() => onRestoreList(item)}
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            {isPending && isRestoringList ? renderLoadingText("restore") : "Khôi phục"}
                          </Button>
                           <ConfirmModal
                            onConfirm={() => {
                              setPendingItemId(item.id);
                              executeDeleteList({ id: item.id, boardId });
                            }}
                            title="Xóa vĩnh viễn danh sách?"
                            description="Bạn có chắc chắn muốn xóa vĩnh viễn danh sách này? Toàn bộ thẻ trong danh sách này cũng sẽ bị xóa."
                            disabled={isMutating}
                          >
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-8 gap-x-1.5 text-red-600 hover:bg-red-50 hover:text-red-700 cursor-pointer"
                              disabled={isMutating}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              {isPending && isDeletingList ? renderLoadingText("delete") : "Xóa"}
                            </Button>
                          </ConfirmModal>
                        </div>
                      </div>
                    );
                  })
                : cards.map((item) => {
                    const isPending = pendingItemId === item.id;

                    return (
                      <div
                        key={item.id}
                        className="rounded-lg border border-neutral-200 bg-white p-3 shadow-sm"
                      >
                        <div className="min-w-0">
                          <div className="break-words text-sm font-semibold text-neutral-800">
                            {item.title}
                          </div>
                          <div className="mt-1 break-words text-xs text-neutral-500">
                            Trong danh sách: {item.listTitle}
                          </div>
                          <div className={cn(
                            "mt-1 flex items-center gap-x-1.5 text-xs",
                            item.listArchivedAt ? "text-amber-600" : "text-neutral-500",
                          )}>
                            <Archive className="h-3.5 w-3.5" />
                            {item.listArchivedAt ? "Danh sách gốc đang lưu trữ" : "Đã lưu trữ"}
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8 gap-x-1.5"
                            disabled={isMutating}
                            onClick={() => onRestoreCard(item)}
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            {isPending && isRestoringCard ? renderLoadingText("restore") : "Khôi phục"}
                          </Button>
                           <ConfirmModal
                            onConfirm={() => {
                              setPendingItemId(item.id);
                              executeDeleteCard({ id: item.id, boardId });
                            }}
                            title="Xóa vĩnh viễn thẻ?"
                            description="Bạn có chắc chắn muốn xóa vĩnh viễn thẻ này?"
                            disabled={isMutating}
                          >
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-8 gap-x-1.5 text-red-600 hover:bg-red-50 hover:text-red-700 cursor-pointer"
                              disabled={isMutating}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              {isPending && isDeletingCard ? renderLoadingText("delete") : "Xóa"}
                            </Button>
                          </ConfirmModal>
                        </div>
                      </div>
                    );
                  })}
            </div>
          ) : null}
        </div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  </DialogPrimitive.Root>
  );
};
