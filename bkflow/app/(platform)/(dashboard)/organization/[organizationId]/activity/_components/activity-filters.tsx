"use client";

import { Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

type BoardOption = {
  id: string;
  title: string;
};

type ActorOption = {
  userId: string;
  userName: string;
  userImage: string;
};

interface ActivityFiltersProps {
  boards: BoardOption[];
  actors: ActorOption[];
  selectedBoardId?: string;
  selectedEventType?: string;
  selectedUserId?: string;
  selectedRange: string;
  searchQuery?: string;
}

const eventTypeOptions = [
  { value: "CREATE", label: "Tạo mới" },
  { value: "UPDATE", label: "Cập nhật" },
  { value: "DELETE", label: "Xóa" },
  { value: "MOVE", label: "Di chuyển" },
  { value: "ASSIGN_MEMBER", label: "Gán thành viên" },
  { value: "COMMENT", label: "Bình luận" },
  { value: "ATTACHMENT", label: "Đính kèm" },
  { value: "CHECKLIST", label: "Checklist" },
  { value: "DUE_DATE", label: "Due date" },
  { value: "LABEL", label: "Label" },
];

const rangeOptions = [
  { value: "today", label: "Hôm nay" },
  { value: "7d", label: "7 ngày qua" },
  { value: "30d", label: "30 ngày qua" },
  { value: "all", label: "Tất cả" },
];

export const ActivityFilters = ({
  boards,
  actors,
  selectedBoardId,
  selectedEventType,
  selectedUserId,
  selectedRange,
  searchQuery,
}: ActivityFiltersProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentQuery = searchParams.get("q") ?? "";
  const [searchValue, setSearchValue] = useState(searchQuery ?? "");

  useEffect(() => {
    setSearchValue(currentQuery);
  }, [currentQuery]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const trimmedSearch = searchValue.trim();

      if (trimmedSearch === currentQuery.trim()) {
        return;
      }

      const params = new URLSearchParams(searchParams.toString());

      if (trimmedSearch) {
        params.set("q", trimmedSearch);
      } else {
        params.delete("q");
      }

      params.set("page", "1");

      const queryString = params.toString();
      router.replace(queryString ? `${pathname}?${queryString}` : pathname);
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [currentQuery, pathname, router, searchParams, searchValue]);

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());

    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }

    params.set("page", "1");

    const queryString = params.toString();
    router.push(queryString ? `${pathname}?${queryString}` : pathname);
  };

  const clearFilters = () => {
    router.push(pathname);
  };

  const clearSearch = () => {
    setSearchValue("");
    updateFilter("q", "");
  };

  return (
    <div className="mt-4 flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-3 shadow-sm">
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="activity-search"
          className="text-xs font-medium uppercase tracking-wide text-neutral-500"
        >
          Tìm kiếm
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <input
            id="activity-search"
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder="Tìm hoạt động..."
            className="h-9 w-full rounded-lg border border-neutral-200 bg-white pl-9 pr-9 text-sm text-neutral-700 outline-none transition placeholder:text-neutral-400 focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
          />
          {searchValue && (
            <button
              type="button"
              onClick={clearSearch}
              className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700"
              aria-label="Xóa tìm kiếm"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="activity-board-filter"
            className="text-xs font-medium uppercase tracking-wide text-neutral-500"
          >
            Bảng
          </label>
          <select
            id="activity-board-filter"
            value={selectedBoardId ?? ""}
            onChange={(event) => updateFilter("boardId", event.target.value)}
            className="h-9 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-700 outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
          >
            <option value="">Tất cả bảng</option>
            {boards.map((board) => (
              <option key={board.id} value={board.id}>
                {board.title}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="activity-event-filter"
            className="text-xs font-medium uppercase tracking-wide text-neutral-500"
          >
            Hành động
          </label>
          <select
            id="activity-event-filter"
            value={selectedEventType ?? ""}
            onChange={(event) => updateFilter("eventType", event.target.value)}
            className="h-9 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-700 outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
          >
            <option value="">Tất cả hành động</option>
            {eventTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="activity-user-filter"
            className="text-xs font-medium uppercase tracking-wide text-neutral-500"
          >
            Người thực hiện
          </label>
          <select
            id="activity-user-filter"
            value={selectedUserId ?? ""}
            onChange={(event) => updateFilter("userId", event.target.value)}
            className="h-9 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-700 outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
          >
            <option value="">Tất cả thành viên</option>
            {actors.map((actor) => (
              <option key={actor.userId} value={actor.userId}>
                {actor.userName}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="activity-range-filter"
            className="text-xs font-medium uppercase tracking-wide text-neutral-500"
          >
            Thời gian
          </label>
          <select
            id="activity-range-filter"
            value={selectedRange}
            onChange={(event) => updateFilter("range", event.target.value)}
            className="h-9 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-700 outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
          >
            {rangeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <button
        type="button"
        onClick={clearFilters}
        className="self-start text-xs font-medium text-violet-600 transition hover:text-violet-700 hover:underline"
      >
        Xóa bộ lọc
      </button>
    </div>
  );
};
