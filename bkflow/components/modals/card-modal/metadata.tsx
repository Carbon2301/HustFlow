"use client";

import { toast } from "sonner";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { 
  Plus, 
  Clock, 
  User, 
  ChevronDown, 
  X, 
  Check, 
  Search 
} from "lucide-react";

import { CardWithList } from "@/types";
import { useAction } from "@/hooks/use-action";
import { updateCard } from "@/actions/update-card";
import { assignCardMember } from "@/actions/assign-card-member";
import { unassignCardMember } from "@/actions/unassign-card-member";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getDueDateStatus } from "@/components/due-date-badge";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Hint } from "@/components/hint";

interface MetadataProps {
  data: CardWithList;
}

const toDateTimeLocalValue = (date?: Date | string | null) => {
  if (!date) {
    return "";
  }
  const parsedDate = new Date(date);
  const timezoneOffset = parsedDate.getTimezoneOffset() * 60_000;
  return new Date(parsedDate.getTime() - timezoneOffset).toISOString().slice(0, 16);
};

const getInitials = (name: string) => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const initials = words.slice(0, 2).map((word) => word[0]).join("");
  return initials.toUpperCase() || "U";
};

export const Metadata = ({
  data,
}: MetadataProps) => {
  const params = useParams();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState("");
  const [dueDateValue, setDueDateValue] = useState(toDateTimeLocalValue(data.dueDate));
  const [reminderValue, setReminderValue] = useState(data.reminder || "none");

  const [isDateOpen, setIsDateOpen] = useState(false);
  const [isMemberOpen, setIsMemberOpen] = useState(false);

  useEffect(() => {
    setDueDateValue(toDateTimeLocalValue(data.dueDate));
    setReminderValue(data.reminder || "none");
  }, [data.dueDate, data.reminder]);

  const { execute: executeUpdateCard, isLoading: isLoadingUpdate } = useAction(updateCard, {
    onSuccess: (updatedCard) => {
      queryClient.invalidateQueries({
        queryKey: ["card", updatedCard.id],
      });
      queryClient.invalidateQueries({
        queryKey: ["card-logs", updatedCard.id],
      });
      toast.success("Đã cập nhật ngày đến hạn");
      setIsDateOpen(false);
    },
    onError: (error) => {
      toast.error(error);
    },
  });

  const { execute: executeAssign, isLoading: isLoadingAssign } = useAction(assignCardMember, {
    onSuccess: (assigned) => {
      queryClient.invalidateQueries({
        queryKey: ["card", data.id],
      });
      queryClient.invalidateQueries({
        queryKey: ["card-logs", data.id],
      });
      toast.success(`Đã giao thẻ cho ${assigned.boardMember.userName}`);
    },
    onError: (error) => {
      toast.error(error);
    },
  });

  const { execute: executeUnassign, isLoading: isLoadingUnassign } = useAction(unassignCardMember, {
    onSuccess: (unassigned) => {
      queryClient.invalidateQueries({
        queryKey: ["card", data.id],
      });
      queryClient.invalidateQueries({
        queryKey: ["card-logs", data.id],
      });
      toast.success(`Đã bỏ giao thẻ cho ${unassigned.boardMember.userName}`);
    },
    onError: (error) => {
      toast.error(error);
    },
  });

  const updateDueDate = (dueDate: Date | null, isCompleted = data.isCompleted, reminder = reminderValue) => {
    const boardId = params.boardId as string;
    executeUpdateCard({
      id: data.id,
      boardId,
      dueDate,
      isCompleted: dueDate ? isCompleted : false,
      reminder: dueDate ? reminder : null,
    });
  };

  const onDateSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const value = formData.get("dueDate") as string;
    const reminder = formData.get("reminder") as string;

    if (!value) {
      updateDueDate(null);
      return;
    }

    if (reminder && reminder !== "none") {
      const offsetMinutes = parseInt(reminder, 10);
      if (!isNaN(offsetMinutes)) {
        const dueDateTime = new Date(value).getTime();
        const triggerTime = dueDateTime - offsetMinutes * 60 * 1000;
        const now = Date.now();

        if (triggerTime < now) {
          const minutesUntilDue = Math.floor((dueDateTime - now) / 60_000);
          if (minutesUntilDue <= 0) {
            toast.error("Thẻ đã hết hạn. Vui lòng cập nhật ngày hết hạn trước.");
          } else {
            const humanize = (mins: number) => {
              if (mins >= 1440) return `${Math.floor(mins / 1440)} ngày`;
              if (mins >= 60) return `${Math.floor(mins / 60)} giờ`;
              return `${mins} phút`;
            };
            toast.error(
              `Thời gian nhắc nhở không hợp lệ. Thẻ chỉ còn ${humanize(minutesUntilDue)} — hãy chọn mốc nhắc ngắn hơn.`
            );
          }
          return;
        }
      }
    }

    updateDueDate(new Date(value), data.isCompleted, reminder);
  };

  const onToggleComplete = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!data.dueDate) return;
    updateDueDate(new Date(data.dueDate), event.target.checked, reminderValue);
  };

  const handleMemberToggle = (memberId: string, isAssigned: boolean) => {
    const boardId = params.boardId as string;
    if (isAssigned) {
      executeUnassign({
        boardId,
        cardId: data.id,
        boardMemberId: memberId,
      });
    } else {
      executeAssign({
        boardId,
        cardId: data.id,
        boardMemberId: memberId,
      });
    }
  };

  // Filter board members based on search
  const filteredBoardMembers = data.boardMembers.filter((member) => {
    const nameMatch = member.userName.toLowerCase().includes(searchQuery.toLowerCase());
    const emailMatch = member.userEmail?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false;
    return nameMatch || emailMatch;
  });

  const hasAssignees = data.assignees && data.assignees.length > 0;
  const hasDueDate = !!data.dueDate;

  // Format dynamic badge for due date
  const status = data.dueDate ? getDueDateStatus(data.dueDate) : "normal";
  const formattedDate = data.dueDate 
    ? format(new Date(data.dueDate), "H:mm d 'thg' M", { locale: vi }) 
    : "";

  const showActionButtonRow = !hasDueDate || !hasAssignees;

  return (
    <div className="space-y-5">
      {/* 1. Action Button Row */}
      {showActionButtonRow && (
        <div className="flex flex-wrap items-center gap-2 mt-1">
          {/* Ngày Button (Only shown when no due date is set) */}
          {!hasDueDate && (
            <Popover open={isDateOpen} onOpenChange={setIsDateOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 active:bg-neutral-100 text-neutral-600 px-3 py-1.5 flex items-center gap-x-1.5 text-xs font-semibold shadow-xs cursor-pointer transition-colors h-8"
                >
                  <Clock className="h-3.5 w-3.5 text-neutral-500" />
                  Ngày
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-[300px] p-3 rounded-xl border border-neutral-200 shadow-xl bg-white z-[9999]" sideOffset={6}>
                <div className="relative pb-2.5 mb-3 border-b border-neutral-100 flex items-center justify-between">
                  <span className="text-sm font-semibold text-neutral-700 mx-auto">Ngày đến hạn</span>
                  <button 
                    type="button" 
                    onClick={() => setIsDateOpen(false)}
                    className="absolute right-0 top-0.5 text-neutral-400 hover:text-neutral-600 rounded-sm"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <form onSubmit={onDateSubmit} className="space-y-4">
                  <div className="flex flex-col gap-y-1">
                    <span className="text-[11px] font-bold text-neutral-500 uppercase">
                      Ngày và giờ hết hạn
                    </span>
                    <input
                      name="dueDate"
                      type="datetime-local"
                      value={dueDateValue}
                      onChange={(event) => setDueDateValue(event.target.value)}
                      disabled={isLoadingUpdate}
                      className="h-9 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-700 shadow-xs outline-none transition focus:border-violet-500 focus:ring-1 focus:ring-violet-200"
                    />
                  </div>
                  
                  <div className="flex flex-col gap-y-1">
                    <span className="text-[11px] font-bold text-neutral-500 uppercase">
                      Thiết lập nhắc nhở
                    </span>
                    <select
                      name="reminder"
                      value={reminderValue}
                      onChange={(event) => setReminderValue(event.target.value)}
                      disabled={isLoadingUpdate}
                      className="h-9 w-full rounded-lg border border-neutral-200 bg-white px-2.5 text-sm text-neutral-700 shadow-xs outline-none transition focus:border-violet-500 focus:ring-1 focus:ring-violet-200 cursor-pointer"
                    >
                      <option value="none">Không có</option>
                      <option value="0">Vào ngày thời điểm hết hạn</option>
                      <option value="5">5 phút trước</option>
                      <option value="10">10 phút trước</option>
                      <option value="15">15 phút trước</option>
                      <option value="30">30 phút trước</option>
                      <option value="60">1 giờ trước</option>
                      <option value="120">2 giờ trước</option>
                      <option value="1440">1 ngày trước</option>
                      <option value="2880">2 ngày trước</option>
                      <option value="10080">1 tuần trước</option>
                      <option value="20160">2 tuần trước</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-x-2 pt-1">
                    <Button
                      type="submit"
                      size="sm"
                      disabled={isLoadingUpdate}
                      className="h-8 rounded-lg bg-violet-600 px-4 text-xs text-white hover:bg-violet-700"
                    >
                      Lưu
                    </Button>
                  </div>
                </form>
              </PopoverContent>
            </Popover>
          )}

          {/* Thành viên Button (Only shown when card has no assignees) */}
          {!hasAssignees && (
            <Popover open={isMemberOpen} onOpenChange={setIsMemberOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 active:bg-neutral-100 text-neutral-600 px-3 py-1.5 flex items-center gap-x-1.5 text-xs font-semibold shadow-xs cursor-pointer transition-colors h-8"
                >
                  <User className="h-3.5 w-3.5 text-neutral-500" />
                  Thành viên
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-[280px] p-3 rounded-xl border border-neutral-200 shadow-xl bg-white z-[9999]" sideOffset={6}>
                <div className="relative pb-2.5 mb-2 border-b border-neutral-100 flex items-center justify-between">
                  <span className="text-sm font-semibold text-neutral-700 mx-auto">Thành viên</span>
                  <button 
                    type="button" 
                    onClick={() => setIsMemberOpen(false)}
                    className="absolute right-0 top-0.5 text-neutral-400 hover:text-neutral-600 rounded-sm"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Search input */}
                <div className="relative mb-2.5">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-neutral-400" />
                  <input
                    type="text"
                    placeholder="Tìm kiếm các thành viên"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full h-8.5 pl-8 pr-3 py-1.5 bg-neutral-50 hover:bg-neutral-100/50 focus:bg-white border border-neutral-200 hover:border-neutral-300 focus:border-violet-500 rounded-lg text-xs transition outline-hidden"
                  />
                </div>

                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide mb-1.5">
                    Thành viên của bảng
                  </p>
                  <div className="max-h-[220px] overflow-y-auto space-y-1 pr-1">
                    {filteredBoardMembers.length === 0 ? (
                      <p className="text-xs text-neutral-400 text-center py-2">Không tìm thấy thành viên</p>
                    ) : (
                      filteredBoardMembers.map((member) => {
                        const isAssigned = data.assignees?.some((a) => a.boardMemberId === member.id) ?? false;
                        const isMutating = isLoadingAssign || isLoadingUnassign;

                        return (
                          <button
                            key={member.id}
                            type="button"
                            disabled={isMutating}
                            onClick={() => handleMemberToggle(member.id, isAssigned)}
                            className="w-full flex items-center gap-x-2.5 px-2 py-1.5 hover:bg-neutral-50 rounded-lg transition text-left cursor-pointer group disabled:opacity-50"
                          >
                            <Avatar className="h-6 w-6">
                              <AvatarImage src={member.userImage} alt={member.userName} />
                              <AvatarFallback className="text-[9px] font-bold">
                                {getInitials(member.userName)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-xs font-medium text-neutral-700 truncate flex-1">
                              {member.userName}
                            </span>
                            {isAssigned && (
                              <Check className="h-3.5 w-3.5 text-violet-600 flex-shrink-0" />
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>
      )}

      {/* 2. Metadata Display Row (Columns) */}
      {(hasAssignees || hasDueDate) && (
        <div className="flex flex-wrap gap-x-8 gap-y-4 pt-1">
          {/* Column A: Thành viên (Active State) */}
          {hasAssignees && (
            <div className="flex flex-col gap-y-1.5">
              <span className="text-xs font-semibold text-neutral-600 pl-0.5">
                Thành viên
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                {data.assignees.map((assignee) => (
                  <Hint 
                    key={assignee.id} 
                    description={assignee.boardMember.userName}
                  >
                    <Avatar className="h-7 w-7 ring-2 ring-white shadow-xs">
                      <AvatarImage 
                        src={assignee.boardMember.userImage} 
                        alt={assignee.boardMember.userName} 
                      />
                      <AvatarFallback className="text-[9px] font-bold">
                        {getInitials(assignee.boardMember.userName)}
                      </AvatarFallback>
                    </Avatar>
                  </Hint>
                ))}

                {/* Plus button inside active state to add more */}
                <Popover open={isMemberOpen} onOpenChange={setIsMemberOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="rounded-full bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 flex items-center justify-center h-7 w-7 cursor-pointer transition-colors shadow-xs"
                      aria-label="Thêm thành viên"
                    >
                      <Plus className="h-3.5 w-3.5 text-neutral-600" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-[280px] p-3 rounded-xl border border-neutral-200 shadow-xl bg-white z-[9999]" sideOffset={6}>
                    <div className="relative pb-2.5 mb-2 border-b border-neutral-100 flex items-center justify-between">
                      <span className="text-sm font-semibold text-neutral-700 mx-auto">Thành viên</span>
                      <button 
                        type="button" 
                        onClick={() => setIsMemberOpen(false)}
                        className="absolute right-0 top-0.5 text-neutral-400 hover:text-neutral-600 rounded-sm"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="relative mb-2.5">
                      <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-neutral-400" />
                      <input
                        type="text"
                        placeholder="Tìm kiếm các thành viên"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full h-8.5 pl-8 pr-3 py-1.5 bg-neutral-50 hover:bg-neutral-100/50 focus:bg-white border border-neutral-200 hover:border-neutral-300 focus:border-violet-500 rounded-lg text-xs transition outline-hidden"
                      />
                    </div>

                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide mb-1.5">
                        Thành viên của bảng
                      </p>
                      <div className="max-h-[220px] overflow-y-auto space-y-1 pr-1">
                        {filteredBoardMembers.length === 0 ? (
                          <p className="text-xs text-neutral-400 text-center py-2">Không tìm thấy thành viên</p>
                        ) : (
                          filteredBoardMembers.map((member) => {
                            const isAssigned = data.assignees?.some((a) => a.boardMemberId === member.id) ?? false;
                            const isMutating = isLoadingAssign || isLoadingUnassign;

                            return (
                              <button
                                key={member.id}
                                type="button"
                                disabled={isMutating}
                                onClick={() => handleMemberToggle(member.id, isAssigned)}
                                className="w-full flex items-center gap-x-2.5 px-2 py-1.5 hover:bg-neutral-50 rounded-lg transition text-left cursor-pointer group disabled:opacity-50"
                              >
                                <Avatar className="h-6 w-6">
                                  <AvatarImage src={member.userImage} alt={member.userName} />
                                  <AvatarFallback className="text-[9px] font-bold">
                                    {getInitials(member.userName)}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-xs font-medium text-neutral-700 truncate flex-1">
                                  {member.userName}
                                </span>
                                {isAssigned && (
                                  <Check className="h-3.5 w-3.5 text-violet-600 flex-shrink-0" />
                                )}
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          )}

          {/* Column B: Ngày hết hạn (Active State) */}
          {hasDueDate && (
            <div className="flex flex-col gap-y-1.5">
              <span className="text-xs font-semibold text-neutral-600 pl-0.5">
                Ngày hết hạn
              </span>
              <div className="flex items-center gap-x-2">
                {/* Complete checkbox */}
                <input
                  type="checkbox"
                  checked={data.isCompleted}
                  onChange={onToggleComplete}
                  disabled={isLoadingUpdate}
                  className="h-4.5 w-4.5 rounded-sm border-neutral-300 accent-violet-600 cursor-pointer shadow-xs"
                />

                {/* Popover trigger button showing formatted date, badge, and caret */}
                <Popover open={isDateOpen} onOpenChange={setIsDateOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex h-8 items-center gap-x-1.5 rounded-lg border border-neutral-200 bg-neutral-50/50 hover:bg-neutral-50 active:bg-neutral-100 px-3 text-xs font-medium text-neutral-700 cursor-pointer transition-colors shadow-xs"
                    >
                      <span>{formattedDate}</span>
                      
                      {/* Badge next to it */}
                      {data.isCompleted ? (
                        <span className="bg-emerald-600 text-white px-1.5 py-0.5 rounded text-[10px] font-bold">
                          Hoàn thành
                        </span>
                      ) : status === "overdue" ? (
                        <span className="bg-red-600 text-white px-1.5 py-0.5 rounded text-[10px] font-bold">
                          Quá hạn
                        </span>
                      ) : status === "warning" ? (
                        <span className="bg-yellow-500 text-white px-1.5 py-0.5 rounded text-[10px] font-bold">
                          Sắp hết hạn
                        </span>
                      ) : null}

                      <ChevronDown className="h-3.5 w-3.5 text-neutral-500 ml-0.5" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-[300px] p-3 rounded-xl border border-neutral-200 shadow-xl bg-white z-[9999]" sideOffset={6}>
                    <div className="relative pb-2.5 mb-3 border-b border-neutral-100 flex items-center justify-between">
                      <span className="text-sm font-semibold text-neutral-700 mx-auto">Ngày đến hạn</span>
                      <button 
                        type="button" 
                        onClick={() => setIsDateOpen(false)}
                        className="absolute right-0 top-0.5 text-neutral-400 hover:text-neutral-600 rounded-sm"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <form onSubmit={onDateSubmit} className="space-y-4">
                      <div className="flex flex-col gap-y-1">
                        <span className="text-[11px] font-bold text-neutral-500 uppercase">
                          Ngày và giờ hết hạn
                        </span>
                        <input
                          name="dueDate"
                          type="datetime-local"
                          value={dueDateValue}
                          onChange={(event) => setDueDateValue(event.target.value)}
                          disabled={isLoadingUpdate}
                          className="h-9 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-700 shadow-xs outline-none transition focus:border-violet-500 focus:ring-1 focus:ring-violet-200"
                        />
                      </div>
                      
                      <div className="flex flex-col gap-y-1">
                        <span className="text-[11px] font-bold text-neutral-500 uppercase">
                          Thiết lập nhắc nhở
                        </span>
                        <select
                          name="reminder"
                          value={reminderValue}
                          onChange={(event) => setReminderValue(event.target.value)}
                          disabled={isLoadingUpdate}
                          className="h-9 w-full rounded-lg border border-neutral-200 bg-white px-2.5 text-sm text-neutral-700 shadow-xs outline-none transition focus:border-violet-500 focus:ring-1 focus:ring-violet-200 cursor-pointer"
                        >
                          <option value="none">Không có</option>
                          <option value="0">Vào ngày thời điểm hết hạn</option>
                          <option value="5">5 phút trước</option>
                          <option value="10">10 phút trước</option>
                          <option value="15">15 phút trước</option>
                          <option value="30">30 phút trước</option>
                          <option value="60">1 giờ trước</option>
                          <option value="120">2 giờ trước</option>
                          <option value="1440">1 ngày trước</option>
                          <option value="2880">2 ngày trước</option>
                          <option value="10080">1 tuần trước</option>
                          <option value="20160">2 tuần trước</option>
                        </select>
                      </div>

                      <div className="flex items-center gap-x-2 pt-1">
                        <Button
                          type="submit"
                          size="sm"
                          disabled={isLoadingUpdate}
                          className="h-8 rounded-lg bg-violet-600 px-4 text-xs text-white hover:bg-violet-700"
                        >
                          Lưu
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={isLoadingUpdate}
                          onClick={() => updateDueDate(null)}
                          className="h-8 rounded-lg text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 text-xs px-3"
                        >
                          Xóa
                        </Button>
                      </div>
                    </form>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

Metadata.Skeleton = function MetadataSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mt-1">
        <Skeleton className="w-16 h-8 rounded-lg bg-neutral-100" />
        <Skeleton className="w-16 h-8 rounded-lg bg-neutral-100" />
      </div>
      <div className="flex flex-wrap gap-x-8 gap-y-4">
        <div className="space-y-2">
          <Skeleton className="w-16 h-3 rounded bg-neutral-100" />
          <div className="flex items-center gap-x-1.5">
            <Skeleton className="w-7 h-7 rounded-full bg-neutral-100" />
            <Skeleton className="w-7 h-7 rounded-full bg-neutral-100" />
          </div>
        </div>
        <div className="space-y-2">
          <Skeleton className="w-20 h-3 rounded bg-neutral-100" />
          <div className="flex items-center gap-x-2">
            <Skeleton className="w-4.5 h-4.5 rounded bg-neutral-100" />
            <Skeleton className="w-32 h-8 rounded-lg bg-neutral-100" />
          </div>
        </div>
      </div>
    </div>
  );
};
