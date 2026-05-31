"use client";

import { AuditLog } from "@prisma/client";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Activity as ActivityIcon, ArrowLeft, Loader2, X } from "lucide-react";

import { ActivityItem } from "@/components/activity-item";
import { Button } from "@/components/ui/button";
import { PopoverClose } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";

type BoardActivityLog = AuditLog & {
  cardTitle?: string;
  cardArchived?: boolean;
  listExists?: boolean;
  checklistExists?: boolean;
  checklistItemExists?: boolean;
};

type BoardActivityResponse = {
  items: BoardActivityLog[];
  memberNames: string[];
  page: number;
  hasMore: boolean;
  nextPage: number | null;
};

interface BoardActivityPopoverContentProps {
  boardId: string;
  onBack: () => void;
}

const fetchBoardActivity = async (boardId: string, page: number) => {
  const response = await fetch(`/api/boards/${boardId}/activity?page=${page}`);

  if (!response.ok) {
    throw new Error("Không thể tải nhật ký hoạt động.");
  }

  return response.json() as Promise<BoardActivityResponse>;
};

export const BoardActivityPopoverContent = ({
  boardId,
  onBack,
}: BoardActivityPopoverContentProps) => {
  const activityQuery = useInfiniteQuery<BoardActivityResponse>({
    queryKey: ["board-activity", boardId],
    queryFn: ({ pageParam }) => {
      const page = typeof pageParam === "number" ? pageParam : 1;
      return fetchBoardActivity(boardId, page);
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.nextPage ?? undefined,
  });

  const items = activityQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const memberNames = Array.from(
    new Set(activityQuery.data?.pages.flatMap((page) => page.memberNames) ?? []),
  );

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden">
      <div className="shrink-0 flex items-center justify-between border-b border-neutral-200 px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-x-2">
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="h-7 w-7 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800"
            onClick={onBack}
            aria-label="Quay lại thao tác bảng"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </Button>
          <div className="flex min-w-0 items-center gap-x-2">
            <ActivityIcon className="h-4 w-4 shrink-0 text-neutral-500" />
            <p className="truncate text-sm font-semibold text-neutral-800">
              Nhật ký hoạt động
            </p>
          </div>
        </div>
        <PopoverClose asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="h-7 w-7 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
            aria-label="Đóng nhật ký hoạt động"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </PopoverClose>
      </div>

      <div
        className="min-h-0 flex-1 overflow-y-auto px-3 py-3 styled-scrollbar"
        style={{ maxHeight: "calc(100vh - 222px)" }}
      >
        {activityQuery.isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-12 w-full rounded-xl bg-neutral-100" />
            <Skeleton className="h-12 w-4/5 rounded-xl bg-neutral-100" />
            <Skeleton className="h-12 w-full rounded-xl bg-neutral-100" />
            <Skeleton className="h-12 w-3/4 rounded-xl bg-neutral-100" />
          </div>
        ) : activityQuery.isError ? (
          <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-3 text-sm text-red-600">
            Không thể tải nhật ký hoạt động.
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-neutral-200 bg-neutral-50/80 px-4 py-8 text-center">
            <ActivityIcon className="mx-auto h-6 w-6 text-neutral-300" />
            <p className="mt-3 text-sm text-neutral-500">
              Chưa có hoạt động nào.
            </p>
          </div>
        ) : (
          <ol className="space-y-3.5">
            {items.map((item) => (
              <ActivityItem
                key={item.id}
                data={item}
                cardTitle={item.cardTitle}
                cardArchived={item.cardArchived}
                listExists={item.listExists}
                checklistExists={item.checklistExists}
                checklistItemExists={item.checklistItemExists}
                memberNames={memberNames}
                hideBoardContext
              />
            ))}
          </ol>
        )}
      </div>

      {!activityQuery.isLoading && !activityQuery.isError && activityQuery.hasNextPage && (
        <div className="shrink-0 border-t border-neutral-200 px-3 py-2.5">
          <Button
            type="button"
            variant="ghost"
            className="h-8 w-full text-sm font-medium text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
            disabled={activityQuery.isFetchingNextPage}
            onClick={() => activityQuery.fetchNextPage()}
          >
            {activityQuery.isFetchingNextPage ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Đang tải...
              </>
            ) : (
              "Xem thêm"
            )}
          </Button>
        </div>
      )}
    </div>
  );
};
