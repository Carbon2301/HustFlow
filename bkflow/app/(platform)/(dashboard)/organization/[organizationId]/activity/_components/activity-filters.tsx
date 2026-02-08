"use client";

import { Search, X, Check, ChevronDown } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { Avatar, AvatarImage } from "@/components/ui/avatar";

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
  selectedBoardIds: string[];
  selectedEventTypes: string[];
  selectedUserIds: string[];
  selectedRange: string;
  searchQuery?: string;
}

interface MultiSelectFilterProps {
  label: string;
  placeholder: string;
  options: { value: string; label: string; image?: string }[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
}

const MultiSelectFilter = ({
  label,
  placeholder,
  options,
  selectedValues,
  onChange,
}: MultiSelectFilterProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleToggle = (value: string) => {
    if (selectedValues.includes(value)) {
      onChange(selectedValues.filter((v) => v !== value));
    } else {
      onChange([...selectedValues, value]);
    }
  };

  const getDisplayText = () => {
    if (selectedValues.length === 0) {
      return placeholder;
    }
    if (selectedValues.length === 1) {
      const option = options.find((o) => o.value === selectedValues[0]);
      return option ? option.label : placeholder;
    }
    return `Đã chọn ${selectedValues.length}`;
  };

  return (
    <div className="flex flex-col gap-1.5" ref={containerRef}>
      <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
        {label}
      </span>
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex h-9 w-full items-center justify-between rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-700 outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100 text-left cursor-pointer hover:bg-neutral-50/50"
        >
          <span className="truncate">{getDisplayText()}</span>
          <ChevronDown className="h-4 w-4 text-neutral-500 flex-shrink-0" />
        </button>

        {isOpen && (
          <div className="absolute left-0 right-0 z-50 mt-1 max-h-60 overflow-y-auto rounded-lg border border-neutral-200 bg-white p-1.5 shadow-md">
            <button
              type="button"
              onClick={() => onChange([])}
              className="flex w-full items-center rounded-md px-2 py-1.5 text-xs font-semibold text-neutral-500 hover:bg-neutral-50 text-left cursor-pointer"
            >
              Tất cả (Mặc định)
            </button>
            <div className="my-1 border-t border-neutral-100" />
            <div className="space-y-0.5">
              {options.map((option) => {
                const isSelected = selectedValues.includes(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleToggle(option.value)}
                    className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50 text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-x-2 truncate">
                      {option.image && (
                        <Avatar className="h-4 w-4 min-w-4 size-4">
                          <AvatarImage src={option.image} alt={option.label} />
                        </Avatar>
                      )}
                      <span className="truncate">{option.label}</span>
                    </div>
                    {isSelected && (
                      <Check className="h-4 w-4 text-violet-600 flex-shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

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
  selectedBoardIds,
  selectedEventTypes,
  selectedUserIds,
  selectedRange,
  searchQuery,
}: ActivityFiltersProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentQuery = searchParams.get("q") ?? "";
  const [searchValue, setSearchValue] = useState(searchQuery ?? "");
  const [prevQuery, setPrevQuery] = useState(currentQuery);
  const [lastSetQuery, setLastSetQuery] = useState(searchQuery ?? "");

  if (currentQuery !== prevQuery) {
    setPrevQuery(currentQuery);
    if (currentQuery !== lastSetQuery) {
      setSearchValue(currentQuery);
      setLastSetQuery(currentQuery);
    }
  }

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
      setLastSetQuery(trimmedSearch);
      router.replace(queryString ? `${pathname}?${queryString}` : pathname);
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [currentQuery, pathname, router, searchParams, searchValue]);

  const updateFilter = (key: string, value: string | string[]) => {
    const params = new URLSearchParams(searchParams.toString());

    if (Array.isArray(value)) {
      const val = value.join(",");
      if (val) {
        params.set(key, val);
      } else {
        params.delete(key);
      }
    } else {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    }

    params.set("page", "1");

    const queryString = params.toString();
    router.push(queryString ? `${pathname}?${queryString}` : pathname);
  };

  const clearFilters = () => {
    setLastSetQuery("");
    setSearchValue("");
    router.push(pathname);
  };

  const clearSearch = () => {
    setLastSetQuery("");
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
        <MultiSelectFilter
          label="Bảng"
          placeholder="Tất cả bảng"
          options={boards.map((board) => ({ value: board.id, label: board.title }))}
          selectedValues={selectedBoardIds}
          onChange={(values) => updateFilter("boardId", values)}
        />

        <MultiSelectFilter
          label="Hành động"
          placeholder="Tất cả hành động"
          options={eventTypeOptions}
          selectedValues={selectedEventTypes}
          onChange={(values) => updateFilter("eventType", values)}
        />

        <MultiSelectFilter
          label="Người thực hiện"
          placeholder="Tất cả thành viên"
          options={actors.map((actor) => ({
            value: actor.userId,
            label: actor.userName,
            image: actor.userImage,
          }))}
          selectedValues={selectedUserIds}
          onChange={(values) => updateFilter("userId", values)}
        />

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
