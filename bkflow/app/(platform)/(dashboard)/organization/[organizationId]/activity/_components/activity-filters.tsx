"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

type BoardOption = {
  id: string;
  title: string;
};

interface ActivityFiltersProps {
  boards: BoardOption[];
  selectedBoardId?: string;
}

export const ActivityFilters = ({
  boards,
  selectedBoardId,
}: ActivityFiltersProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const onBoardChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());

    if (value) {
      params.set("boardId", value);
    } else {
      params.delete("boardId");
    }

    params.set("page", "1");

    const queryString = params.toString();
    router.push(queryString ? `${pathname}?${queryString}` : pathname);
  };

  return (
    <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <label
        htmlFor="activity-board-filter"
        className="text-xs font-medium uppercase tracking-wide text-neutral-500"
      >
        Bảng
      </label>
      <select
        id="activity-board-filter"
        value={selectedBoardId ?? ""}
        onChange={(event) => onBoardChange(event.target.value)}
        className="h-9 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-700 shadow-sm outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100 sm:w-72"
      >
        <option value="">Tất cả bảng</option>
        {boards.map((board) => (
          <option key={board.id} value={board.id}>
            {board.title}
          </option>
        ))}
      </select>
    </div>
  );
};
