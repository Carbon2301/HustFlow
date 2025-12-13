"use client";

import { useState, useMemo } from "react";
import { BoardMember, Label } from "@prisma/client";
import { Filter, UserRound, X, User, ChevronDown, Clock, CalendarDays, Tag } from "lucide-react";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Hint } from "@/components/hint";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  PopoverClose,
} from "@/components/ui/popover";
import { emptyBoardFilters, useBoardFilters } from "@/hooks/use-board-filters";
import { cn } from "@/lib/utils";

interface BoardFiltersProps {
  boardId: string;
  members: BoardMember[];
  currentUserId: string;
  labels: Label[];
}

const getInitials = (name: string) => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const initials = words.slice(0, 2).map((word) => word[0]).join("");

  return initials.toUpperCase() || "U";
};

export const BoardFilters = ({
  boardId,
  members,
  currentUserId,
  labels,
}: BoardFiltersProps) => {
  const filters = useBoardFilters((state) =>
    state.filtersByBoardId[boardId] ?? emptyBoardFilters,
  );
  
  const toggleMyWork = useBoardFilters((state) => state.toggleMyWork);
  const toggleNoMembers = useBoardFilters((state) => state.toggleNoMembers);
  const toggleCompleted = useBoardFilters((state) => state.toggleCompleted);
  const toggleNotCompleted = useBoardFilters((state) => state.toggleNotCompleted);
  const toggleMember = useBoardFilters((state) => state.toggleMember);
  const toggleDueDateFilter = useBoardFilters((state) => state.toggleDueDateFilter);
  const toggleLabel = useBoardFilters((state) => state.toggleLabel);
  const toggleNoLabels = useBoardFilters((state) => state.toggleNoLabels);
  const setSelectedLabels = useBoardFilters((state) => state.setSelectedLabels);
  const clearFilters = useBoardFilters((state) => state.clearFilters);

  const [membersExpanded, setMembersExpanded] = useState(false);
  const [labelsExpanded, setLabelsExpanded] = useState(false);

  const {
    selectedListIds,
    selectedMemberIds,
    myWorkEnabled,
    noMembersEnabled,
    completedEnabled,
    notCompletedEnabled,
    selectedDueDateFilters,
    selectedLabelIds = [],
    noLabelsEnabled = false,
  } = filters;

  const activeFilterCount = useMemo(() => {
    return (
      selectedMemberIds.length +
      selectedListIds.length +
      (myWorkEnabled ? 1 : 0) +
      (noMembersEnabled ? 1 : 0) +
      (completedEnabled ? 1 : 0) +
      (notCompletedEnabled ? 1 : 0) +
      selectedDueDateFilters.length +
      selectedLabelIds.length +
      (noLabelsEnabled ? 1 : 0)
    );
  }, [
    selectedMemberIds,
    selectedListIds,
    myWorkEnabled,
    noMembersEnabled,
    completedEnabled,
    notCompletedEnabled,
    selectedDueDateFilters,
    selectedLabelIds,
    noLabelsEnabled,
  ]);

  const hasActiveFilters = activeFilterCount > 0;
  const currentBoardMember = members.find((member) => member.userId === currentUserId);

  return (
    <div className="flex items-center gap-x-1.5">
      <Hint
        description={currentBoardMember ? "Việc của tôi" : "Bạn chưa là thành viên của bảng này"}
        side="bottom"
        sideOffset={8}
      >
        <Button
          type="button"
          size="icon"
          variant="transparent"
          onClick={() => toggleMyWork(boardId)}
          disabled={!currentBoardMember}
          className={cn(
            "h-8 w-8 rounded-lg border border-white/20 bg-white/10 text-white shadow-sm hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer",
            myWorkEnabled && "border-violet-200 bg-white text-violet-700 hover:bg-violet-50",
          )}
          aria-label="Việc của tôi"
        >
          <UserRound className="h-4 w-4" />
        </Button>
      </Hint>

      <Popover>
        <Hint
          description="Lọc thẻ"
          side="bottom"
          sideOffset={8}
        >
          <PopoverTrigger asChild>
            <Button
              type="button"
              size="icon"
              variant="transparent"
              className={cn(
                "relative h-8 w-8 rounded-lg border border-white/20 bg-white/10 text-white shadow-sm hover:bg-white/20 cursor-pointer",
                hasActiveFilters && "border-violet-200 bg-white text-violet-700 hover:bg-violet-50",
              )}
              aria-label="Lọc thẻ"
            >
              <Filter className="h-4 w-4" />
              {hasActiveFilters && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-violet-600 px-1 text-[10px] font-bold leading-none text-white">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </PopoverTrigger>
        </Hint>
        <PopoverContent
          align="end"
          sideOffset={8}
          className="w-80 rounded-xl border border-neutral-200 bg-white p-4 shadow-xl overflow-y-auto max-h-[480px] styled-scrollbar"
        >
          {/* Header */}
          <div className="relative pb-2.5 mb-3.5 border-b border-neutral-100 flex items-center justify-between">
            <span className="text-sm font-semibold text-neutral-800 mx-auto">Lọc</span>
            <PopoverClose asChild>
              <button 
                type="button" 
                className="absolute right-0 top-0.5 text-neutral-400 hover:text-neutral-600 rounded-sm cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </PopoverClose>
          </div>

          <div className="space-y-4">
            {/* 1. Thành viên Section */}
            <div className="space-y-2">
              <p className="text-sm font-semibold text-neutral-800 pl-0.5">
                Thành viên
              </p>
              
              {/* Không có thành viên */}
              <label className="flex cursor-pointer items-center gap-x-2.5 rounded-lg px-2 py-1.5 transition hover:bg-neutral-50 select-none">
                <input
                  type="checkbox"
                  checked={noMembersEnabled}
                  onChange={() => toggleNoMembers(boardId)}
                  className="h-4 w-4 rounded border-neutral-300 accent-violet-600 cursor-pointer"
                />
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-500">
                  <User className="h-3.5 w-3.5" />
                </div>
                <span className="text-sm text-neutral-700 font-normal">
                  Không có thành viên
                </span>
              </label>

              {/* Các thẻ đã chỉ định cho tôi */}
              {currentBoardMember && (
                <label className="flex cursor-pointer items-center gap-x-2.5 rounded-lg px-2 py-1.5 transition hover:bg-neutral-50 select-none">
                  <input
                    type="checkbox"
                    checked={myWorkEnabled}
                    onChange={() => toggleMyWork(boardId)}
                    className="h-4 w-4 rounded border-neutral-300 accent-violet-600 cursor-pointer"
                  />
                  <Avatar className="h-6 w-6 shrink-0 ring-1 ring-neutral-100">
                    <AvatarImage src={currentBoardMember.userImage} alt={currentBoardMember.userName} />
                    <AvatarFallback className="bg-indigo-600 text-white text-[9px] font-bold">
                      {getInitials(currentBoardMember.userName)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm text-neutral-700 font-normal">
                    Các thẻ đã chỉ định cho tôi
                  </span>
                </label>
              )}

              {/* Chọn thành viên collapsible */}
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => setMembersExpanded(!membersExpanded)}
                  className="w-full flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-neutral-50 transition text-left cursor-pointer select-none"
                >
                  <div className="flex items-center gap-x-2.5">
                    <input
                      type="checkbox"
                      checked={selectedMemberIds.length > 0}
                      readOnly
                      className="h-4 w-4 rounded border-neutral-300 accent-violet-600 pointer-events-none"
                    />
                    <span className="text-sm text-neutral-500 font-normal">
                      Chọn thành viên
                    </span>
                  </div>
                  <ChevronDown className={cn("h-4 w-4 text-neutral-400 transition-transform", membersExpanded && "rotate-180")} />
                </button>

                {membersExpanded && (
                  <div className="pl-7 space-y-1 mt-1 max-h-40 overflow-y-auto pr-1 styled-scrollbar">
                    {members.length === 0 ? (
                      <p className="text-xs text-neutral-400 italic py-1 pl-2">Bảng chưa có thành viên</p>
                    ) : (
                      members.map((member) => {
                        const checked = selectedMemberIds.includes(member.id);
                        return (
                          <label
                            key={member.id}
                            className="flex cursor-pointer items-center gap-x-2.5 rounded-lg px-2 py-1 transition hover:bg-neutral-50 select-none"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleMember(boardId, member.id)}
                              className="h-4 w-4 rounded border-neutral-300 accent-violet-600 cursor-pointer"
                            />
                            <Avatar className="h-5 w-5 shrink-0 ring-1 ring-neutral-100">
                              <AvatarImage src={member.userImage} alt={member.userName} />
                              <AvatarFallback className="bg-neutral-200 text-neutral-700 text-[8px] font-bold">
                                {getInitials(member.userName)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm text-neutral-700 font-normal truncate">
                              {member.userName}
                            </span>
                          </label>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* 2. Card Status Section */}
            <div className="space-y-2 pt-3.5 border-t border-neutral-100">
              <p className="text-sm font-semibold text-neutral-800 pl-0.5">
                Trạng thái thẻ
              </p>
              
              <label className="flex cursor-pointer items-center gap-x-2.5 rounded-lg px-2 py-1.5 transition hover:bg-neutral-50 select-none">
                <input
                  type="checkbox"
                  checked={completedEnabled}
                  onChange={() => toggleCompleted(boardId)}
                  className="h-4 w-4 rounded border-neutral-300 accent-violet-600 cursor-pointer"
                />
                <span className="text-sm text-neutral-700 font-normal">
                  Đã đánh dấu hoàn thành
                </span>
              </label>

              <label className="flex cursor-pointer items-center gap-x-2.5 rounded-lg px-2 py-1.5 transition hover:bg-neutral-50 select-none">
                <input
                  type="checkbox"
                  checked={notCompletedEnabled}
                  onChange={() => toggleNotCompleted(boardId)}
                  className="h-4 w-4 rounded border-neutral-300 accent-violet-600 cursor-pointer"
                />
                <span className="text-sm text-neutral-700 font-normal">
                  Không được đánh dấu là đã hoàn thành
                </span>
              </label>
            </div>

            {/* 3. Ngày hết hạn Section */}
            <div className="space-y-2 pt-3.5 border-t border-neutral-100">
              <p className="text-sm font-semibold text-neutral-800 pl-0.5">
                Ngày hết hạn
              </p>

              {/* Không có ngày hết hạn */}
              <label className="flex cursor-pointer items-center gap-x-2.5 rounded-lg px-2 py-1.5 transition hover:bg-neutral-50 select-none">
                <input
                  type="checkbox"
                  checked={selectedDueDateFilters.includes("no-due")}
                  onChange={() => toggleDueDateFilter(boardId, "no-due")}
                  className="h-4 w-4 rounded border-neutral-300 accent-violet-600 cursor-pointer"
                />
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-600">
                  <CalendarDays className="h-3.5 w-3.5" />
                </div>
                <span className="text-sm text-neutral-700 font-normal">
                  Không có ngày hết hạn
                </span>
              </label>

              {/* Quá hạn */}
              <label className="flex cursor-pointer items-center gap-x-2.5 rounded-lg px-2 py-1.5 transition hover:bg-neutral-50 select-none">
                <input
                  type="checkbox"
                  checked={selectedDueDateFilters.includes("overdue")}
                  onChange={() => toggleDueDateFilter(boardId, "overdue")}
                  className="h-4 w-4 rounded border-neutral-300 accent-violet-600 cursor-pointer"
                />
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-600 text-white">
                  <Clock className="h-3.5 w-3.5" />
                </div>
                <span className="text-sm text-neutral-700 font-normal">
                  Quá hạn
                </span>
              </label>

              {/* Sẽ hết hạn trong 1 tiếng */}
              <label className="flex cursor-pointer items-center gap-x-2.5 rounded-lg px-2 py-1.5 transition hover:bg-neutral-50 select-none">
                <input
                  type="checkbox"
                  checked={selectedDueDateFilters.includes("next-hour")}
                  onChange={() => toggleDueDateFilter(boardId, "next-hour")}
                  className="h-4 w-4 rounded border-neutral-300 accent-violet-600 cursor-pointer"
                />
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-500 text-white">
                  <Clock className="h-3.5 w-3.5" />
                </div>
                <span className="text-sm text-neutral-700 font-normal">
                  Sẽ hết hạn trong 1 tiếng
                </span>
              </label>

              {/* Sẽ hết hạn vào ngày mai */}
              <label className="flex cursor-pointer items-center gap-x-2.5 rounded-lg px-2 py-1.5 transition hover:bg-neutral-50 select-none">
                <input
                  type="checkbox"
                  checked={selectedDueDateFilters.includes("tomorrow")}
                  onChange={() => toggleDueDateFilter(boardId, "tomorrow")}
                  className="h-4 w-4 rounded border-neutral-300 accent-violet-600 cursor-pointer"
                />
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500 text-white">
                  <Clock className="h-3.5 w-3.5" />
                </div>
                <span className="text-sm text-neutral-700 font-normal">
                  Sẽ hết hạn vào ngày mai
                </span>
              </label>

              {/* Sẽ hết hạn vào tuần sau */}
              <label className="flex cursor-pointer items-center gap-x-2.5 rounded-lg px-2 py-1.5 transition hover:bg-neutral-50 select-none">
                <input
                  type="checkbox"
                  checked={selectedDueDateFilters.includes("next-week")}
                  onChange={() => toggleDueDateFilter(boardId, "next-week")}
                  className="h-4 w-4 rounded border-neutral-300 accent-violet-600 cursor-pointer"
                />
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-600">
                  <Clock className="h-3.5 w-3.5" />
                </div>
                <span className="text-sm text-neutral-700 font-normal">
                  Sẽ hết hạn vào tuần sau
                </span>
              </label>

              {/* Sẽ hết hạn vào tháng sau */}
              <label className="flex cursor-pointer items-center gap-x-2.5 rounded-lg px-2 py-1.5 transition hover:bg-neutral-50 select-none">
                <input
                  type="checkbox"
                  checked={selectedDueDateFilters.includes("next-month")}
                  onChange={() => toggleDueDateFilter(boardId, "next-month")}
                  className="h-4 w-4 rounded border-neutral-300 accent-violet-600 cursor-pointer"
                />
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-600">
                  <Clock className="h-3.5 w-3.5" />
                </div>
                <span className="text-sm text-neutral-700 font-normal">
                  Sẽ hết hạn vào tháng sau
                </span>
              </label>
            </div>

            {/* 4. Nhãn Section */}
            <div className="space-y-2 pt-3.5 border-t border-neutral-100">
              <p className="text-sm font-semibold text-neutral-800 pl-0.5">
                Nhãn
              </p>

              {/* Không có Nhãn */}
              <label className="flex cursor-pointer items-center gap-x-2.5 rounded-lg px-2 py-1.5 transition hover:bg-neutral-50 select-none">
                <input
                  type="checkbox"
                  checked={noLabelsEnabled}
                  onChange={() => toggleNoLabels(boardId)}
                  className="h-4 w-4 rounded border-neutral-300 accent-violet-600 cursor-pointer"
                />
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-500">
                  <Tag className="h-3.5 w-3.5" />
                </div>
                <span className="text-sm text-neutral-700 font-normal">
                  Không có Nhãn
                </span>
              </label>

              {/* Hiển thị 3 nhãn màu mặc định */}
              {labels.slice(0, 3).map((label) => {
                const isChecked = selectedLabelIds.includes(label.id);
                return (
                  <label
                    key={label.id}
                    className="flex cursor-pointer items-center gap-x-2.5 rounded-lg px-2 py-1 select-none transition hover:bg-neutral-50"
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleLabel(boardId, label.id)}
                      className="h-4 w-4 rounded border-neutral-300 accent-violet-600 cursor-pointer"
                    />
                    <div
                      style={{ backgroundColor: label.color }}
                      className="flex-1 h-8 rounded-md px-3 flex items-center font-semibold text-neutral-900/90 text-xs shadow-xs border border-black/5"
                    >
                      <span className="truncate">{label.title || "\u00A0"}</span>
                    </div>
                  </label>
                );
              })}

              {/* Collapsible Chọn nhãn */}
              <div className="space-y-1">
                <div className="w-full flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-neutral-50 transition cursor-pointer select-none">
                  <div className="flex items-center gap-x-2.5 flex-1">
                    <input
                      type="checkbox"
                      checked={labels.length > 0 && labels.every((l) => selectedLabelIds.includes(l.id))}
                      onChange={() => {
                        const allSelected = labels.length > 0 && labels.every((l) => selectedLabelIds.includes(l.id));
                        if (allSelected) {
                          setSelectedLabels(boardId, []);
                        } else {
                          setSelectedLabels(boardId, labels.map((l) => l.id));
                        }
                      }}
                      className="h-4 w-4 rounded border-neutral-300 accent-violet-600 cursor-pointer z-10"
                    />
                    <span 
                      onClick={() => setLabelsExpanded(!labelsExpanded)}
                      className="text-sm text-neutral-500 font-normal flex-1 py-1"
                    >
                      Chọn nhãn
                    </span>
                  </div>
                  <ChevronDown 
                    onClick={() => setLabelsExpanded(!labelsExpanded)}
                    className={cn("h-4 w-4 text-neutral-400 transition-transform", labelsExpanded && "rotate-180")} 
                  />
                </div>

                {labelsExpanded && (
                  <div className="pl-7 space-y-1 mt-1 max-h-40 overflow-y-auto pr-1 styled-scrollbar">
                    {labels.length <= 3 ? (
                      <p className="text-xs text-neutral-400 italic py-1 pl-2">Không còn nhãn khác</p>
                    ) : (
                      labels.slice(3).map((label) => {
                        const isChecked = selectedLabelIds.includes(label.id);
                        return (
                          <label
                            key={label.id}
                            className="flex cursor-pointer items-center gap-x-2.5 rounded-lg px-2 py-1 transition hover:bg-neutral-50 select-none"
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleLabel(boardId, label.id)}
                              className="h-4 w-4 rounded border-neutral-300 accent-violet-600 cursor-pointer"
                            />
                            <div
                              style={{ backgroundColor: label.color }}
                              className="flex-1 h-7 rounded-md px-2.5 flex items-center font-semibold text-neutral-900/90 text-xs shadow-xs border border-black/5"
                            >
                              <span className="truncate">{label.title || "\u00A0"}</span>
                            </div>
                          </label>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {hasActiveFilters && (
        <Hint description="Xóa bộ lọc" side="bottom" sideOffset={8}>
          <Button
            type="button"
            size="icon"
            variant="transparent"
            onClick={() => clearFilters(boardId)}
            className="h-8 w-8 rounded-lg border border-white/15 bg-black/20 text-white shadow-sm hover:bg-black/30 cursor-pointer"
            aria-label="Xóa bộ lọc"
          >
            <X className="h-4 w-4" />
          </Button>
        </Hint>
      )}
    </div>
  );
};
