"use client";

import { useOrganization } from "@clerk/nextjs";
import { Dispatch, SetStateAction, useEffect, useMemo, useRef, useState } from "react";
import { AuditLog, BoardMember } from "@prisma/client";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Activity, CalendarDays, ChevronDown, Clock, CreditCard, Filter, RotateCcw, Tag, User, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { ActivityItem } from "@/components/activity-item";
import { DueDateBadge } from "@/components/due-date-badge";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { BoardFilterState, emptyBoardFilters } from "@/hooks/use-board-filters";
import {
  boardFiltersAreActive,
  filterableCardMatchesBoardFilters,
} from "@/lib/boards/board-filters";
import { cn } from "@/lib/utils";

type MemberProfileTab = "activity" | "cards";
type CardSortMode = "dueDate" | "board";

type ProfileLabel = {
  id: string;
  title: string;
  color: string;
  boardId: string;
};

type ProfileMemberOption = {
  id: string;
  userId: string;
  userName: string;
  userImage: string;
};

type ProfileCard = {
  id: string;
  title: string;
  listId: string;
  listTitle: string;
  dueDate: string | null;
  startDate: string | null;
  isCompleted: boolean;
  board: {
    id: string;
    title: string;
    imageThumbUrl: string;
  };
  assignees: {
    id: string;
    boardMemberId: string;
    userId: string;
    userName: string;
    userImage: string;
  }[];
  labels: {
    id: string;
    labelId: string;
    label: {
      id: string;
      title: string;
      color: string;
    };
  }[];
};

type ProfileActivityItem = {
  log: AuditLog;
  boardTitle?: string;
  cardTitle?: string;
  cardArchived?: boolean;
  listExists?: boolean;
};

type MemberProfileResponse = {
  member: Pick<
    BoardMember,
    "id" | "boardId" | "userId" | "userName" | "userImage" | "userEmail" | "role"
  > | null;
  activity: {
    items: ProfileActivityItem[];
    hasMore: boolean;
    page: number;
  };
  cards: ProfileCard[];
  labels: ProfileLabel[];
  memberNames: string[];
};

interface MemberProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: BoardMember;
  boardId: string;
}

const buildProfileUrl = (userId: string, boardId: string, activityPage: number) => {
  const params = new URLSearchParams({
    boardId,
    activityPage: String(activityPage),
  });

  return `/api/members/${encodeURIComponent(userId)}/profile?${params.toString()}`;
};

const getActiveFilterCount = (filters: BoardFilterState) =>
  (filters.completedEnabled ? 1 : 0) +
  (filters.notCompletedEnabled ? 1 : 0) +
  filters.selectedDueDateFilters.length +
  filters.selectedLabelIds.length +
  (filters.noLabelsEnabled ? 1 : 0);

const toggleArrayValue = (values: string[], value: string) =>
  values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];

const getInitials = (name: string) => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const initials = words.slice(0, 2).map((word) => word[0]).join("");

  return initials.toUpperCase() || "U";
};

const compareByDueDate = (a: ProfileCard, b: ProfileCard) => {
  if (!a.dueDate && !b.dueDate) {
    return a.title.localeCompare(b.title, "vi");
  }

  if (!a.dueDate) {
    return 1;
  }

  if (!b.dueDate) {
    return -1;
  }

  return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
};

const compareByBoard = (a: ProfileCard, b: ProfileCard) => {
  const boardCompare = a.board.title.localeCompare(b.board.title, "vi");

  if (boardCompare !== 0) {
    return boardCompare;
  }

  return a.listTitle.localeCompare(b.listTitle, "vi") || a.title.localeCompare(b.title, "vi");
};

const ProfileCardFilters = ({
  members,
  profileMember,
  labels,
  filters,
  setFilters,
}: {
  members: ProfileMemberOption[];
  profileMember: ProfileMemberOption;
  labels: ProfileLabel[];
  filters: BoardFilterState;
  setFilters: Dispatch<SetStateAction<BoardFilterState>>;
}) => {
  const activeFilterCount = getActiveFilterCount(filters);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "h-10 gap-x-2 border-neutral-200 bg-white px-3 text-neutral-700 hover:bg-neutral-50",
            activeFilterCount > 0 && "border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-50",
          )}
        >
          <Filter className="h-4 w-4" />
          Lọc thẻ
          {activeFilterCount > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1 text-[11px] font-semibold text-white">
              {activeFilterCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-80 rounded-xl border border-neutral-200 bg-white p-0 shadow-xl"
      >
        <div
          className="max-h-[min(520px,calc(100vh-160px))] overflow-y-auto overscroll-contain p-4"
          onWheel={(event) => event.stopPropagation()}
        >
        <div className="mb-3 border-b border-neutral-100 pb-3 text-center text-sm font-semibold text-neutral-800">
          Lọc thẻ
        </div>
        <div className="space-y-4">
          {false && (
          <section className="space-y-2">
            <p className="text-sm font-semibold text-neutral-800">Thành viên</p>
            <label className="flex cursor-pointer items-center gap-x-2.5 rounded-lg px-2 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50">
              <input
                type="checkbox"
                checked={filters.noMembersEnabled}
                onChange={() =>
                  setFilters((current) => ({
                    ...current,
                    noMembersEnabled: !current.noMembersEnabled,
                  }))
                }
                className="h-4 w-4 rounded border-neutral-300 accent-blue-600"
              />
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-500">
                <User className="h-3.5 w-3.5" />
              </span>
              Không có thành viên
            </label>
            <label className="flex cursor-pointer items-center gap-x-2.5 rounded-lg px-2 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50">
              <input
                type="checkbox"
                checked={filters.myWorkEnabled}
                onChange={() =>
                  setFilters((current) => ({
                    ...current,
                    myWorkEnabled: !current.myWorkEnabled,
                  }))
                }
                className="h-4 w-4 rounded border-neutral-300 accent-blue-600"
              />
              <Avatar className="h-6 w-6 shrink-0 ring-1 ring-neutral-100">
                <AvatarImage src={profileMember.userImage} alt={profileMember.userName} />
                <AvatarFallback className="bg-blue-600 text-[9px] font-bold text-white">
                  {getInitials(profileMember.userName)}
                </AvatarFallback>
              </Avatar>
              <span className="truncate">Các thẻ đã chỉ định cho {profileMember.userName}</span>
            </label>
            <div className="space-y-1">
              <div className="flex items-center gap-x-2.5 rounded-lg px-2 py-1.5 text-sm text-neutral-500">
                <input
                  type="checkbox"
                  checked={filters.selectedMemberIds.length > 0}
                  readOnly
                  className="h-4 w-4 rounded border-neutral-300 accent-blue-600"
                />
                Chọn thành viên
              </div>
              <div
                className="max-h-40 space-y-1 overflow-y-auto overscroll-contain pl-7 pr-1"
                onWheel={(event) => event.stopPropagation()}
              >
                {members.length === 0 ? (
                  <p className="px-2 py-1 text-xs italic text-neutral-400">
                    Không có thành viên để lọc.
                  </p>
                ) : (
                  members.map((member) => (
                    <label
                      key={member.id}
                      className="flex cursor-pointer items-center gap-x-2.5 rounded-lg px-2 py-1 text-sm text-neutral-700 hover:bg-neutral-50"
                    >
                      <input
                        type="checkbox"
                        checked={filters.selectedMemberIds.includes(member.id)}
                        onChange={() =>
                          setFilters((current) => ({
                            ...current,
                            selectedMemberIds: toggleArrayValue(
                              current.selectedMemberIds,
                              member.id,
                            ),
                          }))
                        }
                        className="h-4 w-4 rounded border-neutral-300 accent-blue-600"
                      />
                      <Avatar className="h-5 w-5 shrink-0 ring-1 ring-neutral-100">
                        <AvatarImage src={member.userImage} alt={member.userName} />
                        <AvatarFallback className="bg-neutral-200 text-[8px] font-bold text-neutral-700">
                          {getInitials(member.userName)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="truncate">{member.userName}</span>
                    </label>
                  ))
                )}
              </div>
            </div>
          </section>

          )}
          <section className="space-y-2">
            <p className="text-sm font-semibold text-neutral-800">Trạng thái thẻ</p>
            <label className="flex cursor-pointer items-center gap-x-2 rounded-lg px-2 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50">
              <input
                type="checkbox"
                checked={filters.completedEnabled}
                onChange={() =>
                  setFilters((current) => ({
                    ...current,
                    completedEnabled: !current.completedEnabled,
                    notCompletedEnabled: !current.completedEnabled
                      ? false
                      : current.notCompletedEnabled,
                  }))
                }
                className="h-4 w-4 rounded border-neutral-300 accent-blue-600"
              />
              Đã đánh dấu hoàn thành
            </label>
            <label className="flex cursor-pointer items-center gap-x-2 rounded-lg px-2 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50">
              <input
                type="checkbox"
                checked={filters.notCompletedEnabled}
                onChange={() =>
                  setFilters((current) => ({
                    ...current,
                    notCompletedEnabled: !current.notCompletedEnabled,
                    completedEnabled: !current.notCompletedEnabled
                      ? false
                      : current.completedEnabled,
                  }))
                }
                className="h-4 w-4 rounded border-neutral-300 accent-blue-600"
              />
              Chưa hoàn thành
            </label>
          </section>

          <section className="space-y-2 border-t border-neutral-100 pt-4">
            <p className="text-sm font-semibold text-neutral-800">Ngày đến hạn</p>
            {[
              ["no-due", "Không có ngày đến hạn"],
              ["overdue", "Quá hạn"],
              ["next-hour", "Sẽ hết hạn trong 1 tiếng"],
              ["tomorrow", "Sẽ hết hạn vào ngày mai"],
              ["next-week", "Sẽ hết hạn vào tuần sau"],
              ["next-month", "Sẽ hết hạn vào tháng sau"],
            ].map(([value, label]) => (
              <label
                key={value}
                className="flex cursor-pointer items-center gap-x-2.5 rounded-lg px-2 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50"
              >
                <input
                  type="checkbox"
                  checked={filters.selectedDueDateFilters.includes(value)}
                  onChange={() =>
                    setFilters((current) => ({
                      ...current,
                      selectedDueDateFilters: toggleArrayValue(
                        current.selectedDueDateFilters,
                        value,
                      ),
                    }))
                  }
                  className="h-4 w-4 rounded border-neutral-300 accent-blue-600"
                />
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                    value === "overdue" && "bg-red-600 text-white",
                    value === "next-hour" && "bg-orange-500 text-white",
                    value === "tomorrow" && "bg-amber-500 text-white",
                    !["overdue", "next-hour", "tomorrow"].includes(value) &&
                      "bg-neutral-100 text-neutral-600",
                  )}
                >
                  {value === "no-due" ? (
                    <CalendarDays className="h-3.5 w-3.5" />
                  ) : (
                    <Clock className="h-3.5 w-3.5" />
                  )}
                </span>
                {label}
              </label>
            ))}
          </section>

          <section className="space-y-2 border-t border-neutral-100 pt-4">
            <p className="text-sm font-semibold text-neutral-800">Nhãn</p>
            <label className="flex cursor-pointer items-center gap-x-2 rounded-lg px-2 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50">
              <input
                type="checkbox"
                checked={filters.noLabelsEnabled}
                onChange={() =>
                  setFilters((current) => ({
                    ...current,
                    noLabelsEnabled: !current.noLabelsEnabled,
                  }))
                }
                className="h-4 w-4 rounded border-neutral-300 accent-blue-600"
              />
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-500">
                <Tag className="h-3.5 w-3.5" />
              </span>
              Không có nhãn
            </label>
            {labels.length === 0 ? (
              <p className="rounded-lg bg-neutral-50 px-3 py-2 text-xs text-neutral-500">
                Không có nhãn để lọc.
              </p>
            ) : (
              labels.map((label) => (
                <label
                  key={label.id}
                  className="flex cursor-pointer items-center gap-x-2 rounded-lg px-2 py-1.5 hover:bg-neutral-50"
                >
                  <input
                    type="checkbox"
                    checked={filters.selectedLabelIds.includes(label.id)}
                    onChange={() =>
                      setFilters((current) => ({
                        ...current,
                        selectedLabelIds: toggleArrayValue(
                          current.selectedLabelIds,
                          label.id,
                        ),
                      }))
                    }
                    className="h-4 w-4 rounded border-neutral-300 accent-blue-600"
                  />
                  <span
                    className="h-7 min-w-0 flex-1 rounded-md border border-black/5 px-2.5 text-xs font-semibold leading-7 text-neutral-900/90"
                    style={{ backgroundColor: label.color }}
                  >
                    <span className="block truncate">{label.title || "\u00A0"}</span>
                  </span>
                </label>
              ))
            )}
          </section>
        </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export const MemberProfileModal = ({
  open,
  onOpenChange,
  member,
  boardId,
}: MemberProfileModalProps) => {
  const { organization } = useOrganization();
  const [tab, setTab] = useState<MemberProfileTab>("activity");
  const [sortMode, setSortMode] = useState<CardSortMode>("dueDate");
  const [filters, setFilters] = useState<BoardFilterState>(emptyBoardFilters);
  const pushedHistoryRef = useRef(false);

  const profileQuery = useInfiniteQuery<MemberProfileResponse>({
    queryKey: ["member-profile", member.userId, boardId],
    queryFn: async ({ pageParam }) => {
      const activityPage = typeof pageParam === "number" ? pageParam : 1;
      const response = await fetch(buildProfileUrl(member.userId, boardId, activityPage));

      if (!response.ok) {
        throw new Error("Không thể tải hồ sơ thành viên.");
      }

      return response.json();
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.activity.hasMore ? lastPage.activity.page + 1 : undefined,
    enabled: open,
  });

  const firstPage = profileQuery.data?.pages[0];
  const profileMember = firstPage?.member ?? member;
  const activeFilters = boardFiltersAreActive(filters);
  const activityItems = useMemo(
    () => profileQuery.data?.pages.flatMap((page) => page.activity.items) ?? [],
    [profileQuery.data?.pages],
  );
  const memberOptions = useMemo(() => {
    const options = new Map<string, ProfileMemberOption>();

    (firstPage?.cards ?? []).forEach((card) => {
      card.assignees.forEach((assignee) => {
        options.set(assignee.boardMemberId, {
          id: assignee.boardMemberId,
          userId: assignee.userId,
          userName: assignee.userName,
          userImage: assignee.userImage,
        });
      });
    });

    return Array.from(options.values()).sort((a, b) =>
      a.userName.localeCompare(b.userName, "vi"),
    );
  }, [firstPage?.cards]);
  const profileMemberOption: ProfileMemberOption = {
    id: profileMember.id,
    userId: profileMember.userId,
    userName: profileMember.userName,
    userImage: profileMember.userImage,
  };
  const profileMemberBoardMemberIds = useMemo(
    () =>
      memberOptions
        .filter((option) => option.userId === profileMember.userId)
        .map((option) => option.id),
    [memberOptions, profileMember.userId],
  );

  const visibleCards = useMemo(() => {
    const effectiveFilters = filters.myWorkEnabled
      ? {
          ...filters,
          myWorkEnabled: false,
          selectedMemberIds: Array.from(
            new Set([
              ...filters.selectedMemberIds,
              ...profileMemberBoardMemberIds,
            ]),
          ),
        }
      : filters;

    const filteredCards = (firstPage?.cards ?? []).filter((card) =>
      filterableCardMatchesBoardFilters(
        {
          listId: card.listId,
          dueDate: card.dueDate,
          isCompleted: card.isCompleted,
          assignees: card.assignees,
          labels: card.labels,
        },
        effectiveFilters,
      ),
    );

    return [...filteredCards].sort(
      sortMode === "dueDate" ? compareByDueDate : compareByBoard,
    );
  }, [filters, firstPage?.cards, profileMemberBoardMemberIds, sortMode]);

  const isInitialLoading = profileQuery.isLoading;
  const resetProfileUi = () => {
    setTab("activity");
    setFilters(emptyBoardFilters);
  };
  const closeForNavigation = () => {
    pushedHistoryRef.current = false;
    resetProfileUi();
    onOpenChange(false);
  };

  useEffect(() => {
    if (!open || typeof window === "undefined") {
      return;
    }

    window.history.pushState(
      { bkflowMemberProfile: member.userId },
      "",
      window.location.href,
    );
    pushedHistoryRef.current = true;

    const handlePopState = () => {
      pushedHistoryRef.current = false;
      resetProfileUi();
      onOpenChange(false);
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [member.userId, onOpenChange, open]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      resetProfileUi();

      if (pushedHistoryRef.current && typeof window !== "undefined") {
        pushedHistoryRef.current = false;
        window.history.back();
        return;
      }
    }

    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="left-0 top-0 block h-dvh max-h-dvh w-screen max-w-none translate-x-0 translate-y-0 overflow-hidden rounded-none border-0 bg-white p-0 text-neutral-900 ring-0 sm:max-w-none"
      >
        <DialogTitle className="sr-only">Hồ sơ thành viên</DialogTitle>
        <button
          type="button"
          onClick={() => handleOpenChange(false)}
          className="absolute right-5 top-5 z-20 flex h-14 w-14 cursor-pointer items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-600 shadow-sm transition hover:bg-neutral-50 hover:text-neutral-900"
          aria-label="Đóng hồ sơ thành viên"
        >
          <X className="h-7 w-7" />
        </button>

        <div className="flex h-full min-h-0 flex-col md:flex-row">
          <aside className="shrink-0 border-b border-neutral-200 bg-neutral-50 px-5 pb-4 pt-16 md:h-full md:w-[280px] md:border-b-0 md:border-r md:px-7 md:pt-16">
            <p className="mb-4 text-base font-semibold text-neutral-900">
              Cài đặt cá nhân
            </p>
            <div className="flex gap-2 md:block md:space-y-1">
              <button
                type="button"
                onClick={() => setTab("activity")}
                className={cn(
                  "flex h-11 flex-1 cursor-pointer items-center gap-x-3 rounded-lg border px-3 text-left text-sm font-semibold transition md:w-full",
                  tab === "activity"
                    ? "border-blue-500 bg-blue-50 text-neutral-900"
                    : "border-transparent text-neutral-700 hover:bg-white",
                )}
              >
                <Activity className="h-5 w-5" />
                Hoạt động
              </button>
              <button
                type="button"
                onClick={() => setTab("cards")}
                className={cn(
                  "flex h-11 flex-1 cursor-pointer items-center gap-x-3 rounded-lg border px-3 text-left text-sm font-semibold transition md:w-full",
                  tab === "cards"
                    ? "border-blue-500 bg-blue-50 text-neutral-900"
                    : "border-transparent text-neutral-700 hover:bg-white",
                )}
              >
                <CreditCard className="h-5 w-5" />
                Thẻ
              </button>
            </div>
            <div className="mt-8 hidden border-t border-neutral-200 md:block" />
          </aside>

          <main className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-12 pt-8 md:px-20 md:pt-20">
            {tab === "activity" ? (
              <section className="mx-auto max-w-3xl">
                <div className="flex items-center gap-x-4">
                  <Activity className="h-8 w-8 text-neutral-700" />
                  <h3 className="text-xl font-bold text-neutral-900">Hoạt động</h3>
                </div>

                {isInitialLoading ? (
                  <div className="mt-6 space-y-5">
                    <Skeleton className="h-14 w-full rounded-xl" />
                    <Skeleton className="h-14 w-[82%] rounded-xl" />
                    <Skeleton className="h-14 w-[92%] rounded-xl" />
                  </div>
                ) : profileQuery.isError ? (
                  <p className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                    Không thể tải hoạt động của thành viên này.
                  </p>
                ) : activityItems.length === 0 ? (
                  <p className="mt-6 rounded-lg bg-neutral-50 px-4 py-3 text-sm text-neutral-500">
                    Chưa có hoạt động nào có thể xem.
                  </p>
                ) : (
                  <>
                    <ol className="mt-6 space-y-5">
                      {activityItems.map((item) => (
                        <ActivityItem
                          key={item.log.id}
                          data={item.log}
                          boardTitle={item.boardTitle}
                          cardTitle={item.cardTitle}
                          cardArchived={item.cardArchived}
                          listExists={item.listExists}
                          memberNames={firstPage?.memberNames ?? []}
                          onNavigate={closeForNavigation}
                        />
                      ))}
                    </ol>
                    {profileQuery.hasNextPage && (
                      <Button
                        type="button"
                        variant="outline"
                        className="mt-6 h-11 border-neutral-200 bg-white px-4 text-base text-neutral-700 hover:bg-neutral-50"
                        disabled={profileQuery.isFetchingNextPage}
                        onClick={() => profileQuery.fetchNextPage()}
                      >
                        {profileQuery.isFetchingNextPage ? "Đang tải..." : "Tải thêm hoạt động"}
                      </Button>
                    )}
                  </>
                )}
              </section>
            ) : (
              <section className="mx-auto max-w-7xl">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                  <h2 className="text-3xl font-bold text-neutral-900">Thẻ</h2>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="relative">
                      <select
                        value={sortMode}
                        onChange={(event) => setSortMode(event.target.value as CardSortMode)}
                        className="h-10 cursor-pointer appearance-none rounded-md border border-neutral-200 bg-white py-0 pl-4 pr-10 text-sm font-medium text-neutral-600 outline-none transition hover:bg-neutral-50 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                      >
                        <option value="dueDate">Sắp xếp theo ngày đến hạn</option>
                        <option value="board">Sắp xếp theo Bảng thông tin</option>
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
                    </div>
                    <ProfileCardFilters
                      members={memberOptions}
                      profileMember={profileMemberOption}
                      labels={firstPage?.labels ?? []}
                      filters={filters}
                      setFilters={setFilters}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="h-10 gap-x-2 border-neutral-200 bg-white px-3 text-neutral-600 hover:bg-neutral-50"
                      disabled={!activeFilters}
                      onClick={() => setFilters(emptyBoardFilters)}
                    >
                      <RotateCcw className="h-4 w-4" />
                      Xóa bộ lọc
                    </Button>
                  </div>
                </div>

                {profileQuery.isLoading ? (
                  <div className="mt-10 space-y-3">
                    <Skeleton className="h-11 w-full rounded-lg" />
                    <Skeleton className="h-16 w-full rounded-lg" />
                    <Skeleton className="h-16 w-full rounded-lg" />
                  </div>
                ) : profileQuery.isError ? (
                  <p className="mt-8 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                    Không thể tải thẻ của thành viên này.
                  </p>
                ) : visibleCards.length === 0 ? (
                  <p className="mt-8 rounded-lg bg-neutral-50 px-4 py-3 text-sm text-neutral-500">
                    {activeFilters
                      ? "Không có thẻ nào phù hợp với bộ lọc hiện tại."
                      : `${profileMember.userName} chưa được gán thẻ nào.`}
                  </p>
                ) : (
                  <div className="mt-8 overflow-x-auto md:mt-10">
                    <table className="w-full min-w-[920px] border-collapse text-left">
                      <thead>
                        <tr className="border-b border-neutral-200 text-sm font-semibold text-neutral-500">
                          <th className="w-[22%] px-2 py-3">Thẻ</th>
                          <th className="w-[20%] px-2 py-3">Danh sách</th>
                          <th className="w-[22%] px-2 py-3">Nhãn</th>
                          <th className="w-[17%] px-2 py-3">Ngày đến hạn</th>
                          <th className="w-[19%] px-2 py-3">Bảng thông tin</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleCards.map((card) => (
                          <tr
                            key={card.id}
                            className="border-b border-neutral-100 text-base text-neutral-700"
                          >
                            <td className="px-2 py-4 align-middle">
                              <Link
                                href={`/board/${card.board.id}?cardId=${card.id}`}
                                onClick={closeForNavigation}
                                className="cursor-pointer break-words font-medium text-neutral-800 transition hover:text-blue-700 hover:underline"
                              >
                                {card.title}
                              </Link>
                            </td>
                            <td className="px-2 py-4 align-middle text-neutral-600">
                              <span className="break-words">
                                {card.listTitle}
                              </span>
                            </td>
                            <td className="px-2 py-4 align-middle">
                              {card.labels.length === 0 ? (
                                <span className="text-sm text-neutral-400">-</span>
                              ) : (
                                <div className="flex flex-wrap gap-1.5">
                                  {card.labels.map((cardLabel) => (
                                    <span
                                      key={cardLabel.id}
                                      className="h-2.5 w-14 rounded-full"
                                      title={cardLabel.label.title}
                                      style={{ backgroundColor: cardLabel.label.color }}
                                    />
                                  ))}
                                </div>
                              )}
                            </td>
                            <td className="px-2 py-4 align-middle">
                              {card.dueDate || card.startDate ? (
                                <DueDateBadge
                                  dueDate={card.dueDate}
                                  startDate={card.startDate}
                                  isCompleted={card.isCompleted}
                                  isCard
                                />
                              ) : (
                                <span className="text-sm text-neutral-400">-</span>
                              )}
                            </td>
                            <td className="px-2 py-4 align-middle">
                              <Link
                                href={`/board/${card.board.id}`}
                                onClick={closeForNavigation}
                                className="flex min-w-0 cursor-pointer items-center gap-x-3 rounded-md transition hover:text-blue-700"
                              >
                                <Image
                                  src={card.board.imageThumbUrl}
                                  alt={card.board.title}
                                  width={56}
                                  height={40}
                                  className="h-10 w-14 shrink-0 rounded-sm object-cover"
                                />
                                <span className="min-w-0">
                                  <span className="block truncate font-semibold text-neutral-800">
                                    {card.board.title}
                                  </span>
                                  <span className="block truncate text-sm text-neutral-500">
                                    {organization?.name ?? "Không gian làm việc"}
                                  </span>
                                </span>
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}
          </main>
        </div>
      </DialogContent>
    </Dialog>
  );
};
