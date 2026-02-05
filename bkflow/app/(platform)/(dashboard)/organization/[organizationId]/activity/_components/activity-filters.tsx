"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

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
  from?: string;
  to?: string;
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
}: ActivityFiltersProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

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

  return (
    <div className="mt-4 flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-3 shadow-sm">
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
