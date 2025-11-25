"use client";

import { toast } from "sonner";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { 
  Plus, 
  Clock, 
  User, 
  ChevronDown, 
  X, 
  Check, 
  Search,
  Tag,
  CheckSquare,
  Paperclip
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
  formatDateTimeLocalInput,
  getDateTimezoneOffset,
  parseDateTimeLocalInput,
} from "@/lib/date-utils";
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
import { LabelPopover } from "./label-popover";
import { getColorName } from "@/lib/utils";
import { ChecklistPopover } from "./checklist-popover";
import { useBoardCalendarInvalidation } from "@/hooks/use-board-calendar-invalidation";

interface MetadataProps {
  data: CardWithList;
  onOpenAttachment?: () => void;
}

const getInitials = (name: string) => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const initials = words.slice(0, 2).map((word) => word[0]).join("");
  return initials.toUpperCase() || "U";
};

export const Metadata = ({
  data,
  onOpenAttachment,
}: MetadataProps) => {
  const params = useParams();
  const boardId = params.boardId as string;
  const router = useRouter();
  const queryClient = useQueryClient();
  const invalidateBoardCalendar = useBoardCalendarInvalidation(boardId);

  const [searchQuery, setSearchQuery] = useState("");
  const [startDateValue, setStartDateValue] = useState(formatDateTimeLocalInput(data.startDate));
  const [dueDateValue, setDueDateValue] = useState(formatDateTimeLocalInput(data.dueDate));
  const [reminderValue, setReminderValue] = useState(data.reminder || "none");

  const [isDateOpen, setIsDateOpen] = useState(false);
  const [isMemberOpen, setIsMemberOpen] = useState(false);

  useEffect(() => {
    setStartDateValue(formatDateTimeLocalInput(data.startDate));
    setDueDateValue(formatDateTimeLocalInput(data.dueDate));
    setReminderValue(data.reminder || "none");
  }, [data.startDate, data.dueDate, data.reminder]);

  const { execute: executeUpdateCard, isLoading: isLoadingUpdate } = useAction(updateCard, {
    onSuccess: (updatedCard) => {
      queryClient.invalidateQueries({
        queryKey: ["card", updatedCard.id],
      });
      queryClient.invalidateQueries({
        queryKey: ["card-logs", updatedCard.id],
      });
      invalidateBoardCalendar();
      router.refresh();
      
      if (updatedCard.isCompleted !== data.isCompleted) {
        toast.success(
          updatedCard.isCompleted 
            ? "Đã đánh dấu hoàn thành thẻ" 
            : "Đã bỏ đánh dấu hoàn thành thẻ"
        );
      } else {
        toast.success("Đã cập nhật lịch biểu");
      }
      setIsDateOpen(false);
    },
    onError: (error) => {
      toast.error(error);
    },
  });

  const { execute: executeAssign, isLoading: isLoadingAssign } = useAction(assignCardMember, {
    onSuccess: (assigned) => {
      invalidateBoardCalendar();
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
      invalidateBoardCalendar();
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

  const updateDateRange = ({
    startDate,
    dueDate,
    isCompleted,
    reminder,
  }: {
    startDate?: Date | null;
    dueDate?: Date | null;
    isCompleted?: boolean;
    reminder?: string | null;
  }) => {
    const boardId = params.boardId as string;

    if (
      startDate === undefined &&
      dueDate === undefined &&
      (isCompleted === undefined || isCompleted === data.isCompleted) &&
      (reminder === undefined || reminder === (data.reminder || "none"))
    ) {
      return;
    }

    const nextIsCompleted = dueDate === undefined
      ? isCompleted
      : (dueDate ? (isCompleted ?? data.isCompleted) : false);
    const nextReminder = dueDate === undefined
      ? reminder
      : (dueDate ? (reminder ?? reminderValue) : null);

    executeUpdateCard({
      id: data.id,
      boardId,
      ...(startDate !== undefined ? { startDate } : {}),
      ...(dueDate !== undefined ? { dueDate } : {}),
      dueDateTimezoneOffset: dueDate
        ? getDateTimezoneOffset(dueDate)
        : startDate
          ? getDateTimezoneOffset(startDate)
          : undefined,
      ...(nextIsCompleted !== undefined ? { isCompleted: nextIsCompleted } : {}),
      ...(nextReminder !== undefined ? { reminder: nextReminder } : {}),
    });
  };

  const updateDueDate = (
    dueDate: Date | null,
    isCompleted = data.isCompleted,
    reminder = reminderValue,
  ) => {
    updateDateRange({ dueDate, isCompleted, reminder });
  };

  const updateStartDate = (startDate: Date | null) => {
    if (
      (startDate === null && !data.startDate) ||
      (startDate && data.startDate && startDate.getTime() === new Date(data.startDate).getTime())
    ) {
      return;
    }

    updateDateRange({ startDate });
  };

  const onDateSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const startValue = formData.get("startDate") as string;
    const value = formData.get("dueDate") as string;
    const reminder = formData.get("reminder") as string;

    const parsedStartDate = startValue
      ? parseDateTimeLocalInput(startValue)
      : null;
    const parsedDueDate = value
      ? parseDateTimeLocalInput(value)
      : null;

    const normReminder = reminder === "none" || !reminder ? "none" : reminder;
    const normOldReminder = data.reminder === "none" || !data.reminder ? "none" : data.reminder;

    const startDateChanged = (parsedStartDate?.getTime() ?? null) !== (data.startDate ? new Date(data.startDate).getTime() : null);
    const dueDateChanged = (parsedDueDate?.getTime() ?? null) !== (data.dueDate ? new Date(data.dueDate).getTime() : null);
    const reminderChanged = normReminder !== normOldReminder;

    if (!startDateChanged && !dueDateChanged && !reminderChanged) {
      setIsDateOpen(false);
      return;
    }

    if (startValue && !parsedStartDate) {
      toast.error("Ngày bắt đầu không hợp lệ.");
      return;
    }

    if (value && !parsedDueDate) {
      toast.error("Ngày hết hạn không hợp lệ.");
      return;
    }

    if (
      parsedStartDate &&
      parsedDueDate &&
      parsedStartDate.getTime() > parsedDueDate.getTime()
    ) {
      toast.error("Ngày bắt đầu phải trước hoặc bằng ngày hết hạn.");
      return;
    }

    if (!parsedDueDate && reminder && reminder !== "none") {
      toast.error("Vui lòng đặt ngày hết hạn trước khi thiết lập nhắc nhở.");
      return;
    }

    if (parsedDueDate && reminder && reminder !== "none") {
      const offsetMinutes = parseInt(reminder, 10);
      if (!Number.isNaN(offsetMinutes)) {
        const dueDateTime = parsedDueDate.getTime();
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

    updateDateRange({
      startDate: parsedStartDate,
      dueDate: parsedDueDate,
      isCompleted: data.isCompleted,
      reminder,
    });
  };

  const onToggleComplete = (event: React.ChangeEvent<HTMLInputElement>) => {
    const checked = event.target.checked;
    const boardId = params.boardId as string;
    executeUpdateCard({
      id: data.id,
      boardId,
      isCompleted: checked,
    });
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
  const hasStartDate = !!data.startDate;
  const hasDueDate = !!data.dueDate;
  const hasDateRange = hasStartDate || hasDueDate;
  const hasLabels = data.labels && data.labels.length > 0;
  const canSetReminder = !!dueDateValue;

  const status = data.dueDate ? getDueDateStatus(data.dueDate) : "normal";
  const formattedDate = data.dueDate 
    ? format(new Date(data.dueDate), "H:mm d 'thg' M", { locale: vi }) 
    : "";
  const formattedStartDate = data.startDate
    ? format(new Date(data.startDate), "H:mm d 'thg' M", { locale: vi })
    : "";
  const dateSummary = hasStartDate && hasDueDate
    ? `Bắt đầu ${formattedStartDate} - Hết hạn ${formattedDate}`
    : hasStartDate
      ? `Bắt đầu ${formattedStartDate}`
      : hasDueDate
        ? `Hết hạn ${formattedDate}`
        : "";

  const showActionButtonRow = true;

  return (
    <div className="space-y-5">
      {/* 1. Action Button Row */}
      {showActionButtonRow && (
        <div className="flex flex-wrap items-center gap-2 mt-1">
          {/* Ngày Button (Only shown when no schedule is set) */}
          {!hasDateRange && (
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
                  <span className="text-sm font-semibold text-neutral-700 mx-auto">Ngày</span>
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
                      Ngày và giờ bắt đầu
                    </span>
                    <input
                      name="startDate"
                      aria-label="Ngày và giờ bắt đầu"
                      type="datetime-local"
                      value={startDateValue}
                      onChange={(event) => setStartDateValue(event.target.value)}
                      disabled={isLoadingUpdate}
                      className="h-9 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-700 shadow-xs outline-none transition focus:border-violet-500 focus:ring-1 focus:ring-violet-200"
                    />
                  </div>
                  <div className="flex flex-col gap-y-1">
                    <span className="text-[11px] font-bold text-neutral-500 uppercase">
                      Ngày và giờ hết hạn
                    </span>
                    <input
                      name="dueDate"
                      aria-label="Ngày và giờ hết hạn"
                      type="datetime-local"
                      value={dueDateValue}
                      onChange={(event) => {
                        setDueDateValue(event.target.value);
                        if (!event.target.value) {
                          setReminderValue("none");
                        }
                      }}
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
                      aria-label="Thiết lập nhắc nhở"
                      value={reminderValue}
                      onChange={(event) => setReminderValue(event.target.value)}
                      disabled={isLoadingUpdate || !canSetReminder}
                      className="h-9 w-full rounded-lg border border-neutral-200 bg-white px-2.5 text-sm text-neutral-700 shadow-xs outline-none transition focus:border-violet-500 focus:ring-1 focus:ring-violet-200 disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-400 cursor-pointer"
                    >
                      <option value="none">Không có</option>
                      <option value="0">Vào thời điểm hết hạn</option>
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

          {/* Nhãn Button (Only shown when card has no labels) */}
          {!hasLabels && (
            <LabelPopover
              cardId={data.id}
              boardId={boardId}
              labels={data.labels}
              boardLabels={data.boardLabels}
            >
              <button
                type="button"
                className="rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 active:bg-neutral-100 text-neutral-600 px-3 py-1.5 flex items-center gap-x-1.5 text-xs font-semibold shadow-xs cursor-pointer transition-colors h-8"
              >
                <Tag className="h-3.5 w-3.5 text-neutral-500" />
                Nhãn
              </button>
            </LabelPopover>
          )}

          {/* Việc cần làm Button */}
          <ChecklistPopover
            cardId={data.id}
            boardId={boardId}
            boardChecklists={data.boardChecklists || []}
          >
            <button
              type="button"
              className="rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 active:bg-neutral-100 text-neutral-600 px-3 py-1.5 flex items-center gap-x-1.5 text-xs font-semibold shadow-xs cursor-pointer transition-colors h-8"
            >
              <CheckSquare className="h-3.5 w-3.5 text-neutral-500" />
              Việc cần làm
            </button>
          </ChecklistPopover>

          {/* Tệp đính kèm Button */}
          <button
            type="button"
            onClick={onOpenAttachment}
            className="rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 active:bg-neutral-100 text-neutral-600 px-3 py-1.5 flex items-center gap-x-1.5 text-xs font-semibold shadow-xs cursor-pointer transition-colors h-8"
          >
            <Paperclip className="h-3.5 w-3.5 text-neutral-500" />
            Đính kèm
          </button>
        </div>
      )}

      {/* 2. Metadata Display Row (Columns) */}
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

        {/* Column B: Nhãn (Active State) */}
        {hasLabels && (
          <div className="flex flex-col gap-y-1.5">
            <span className="text-xs font-semibold text-neutral-600 pl-0.5">
              Nhãn
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              {data.labels.map((cardLabel) => (
                <Hint
                  key={cardLabel.id}
                  description={`Màu: ${getColorName(cardLabel.label.color)}, Tiêu đề: ${cardLabel.label.title || "Không"}`}
                  side="bottom"
                >
                  <div className="inline-block">
                    <LabelPopover
                      cardId={data.id}
                      boardId={boardId}
                      labels={data.labels}
                      boardLabels={data.boardLabels}
                    >
                      <button
                        type="button"
                        style={{ backgroundColor: cardLabel.label.color }}
                        className="h-8 min-w-[32px] max-w-[140px] px-3 rounded-md flex items-center font-bold text-neutral-900/90 text-xs shadow-xs border border-black/5 hover:opacity-85 transition cursor-pointer"
                      >
                        <span className="truncate">{cardLabel.label.title}</span>
                      </button>
                    </LabelPopover>
                  </div>
                </Hint>
              ))}

              {/* Plus button inside active state to add/remove labels */}
              <LabelPopover
                cardId={data.id}
                boardId={boardId}
                labels={data.labels}
                boardLabels={data.boardLabels}
              >
                <button
                  type="button"
                  className="rounded-lg bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 flex items-center justify-center h-8 w-8 cursor-pointer transition-colors shadow-xs"
                  aria-label="Quản lý nhãn"
                >
                  <Plus className="h-4 w-4 text-neutral-600" />
                </button>
              </LabelPopover>
            </div>
          </div>
        )}

        {/* Column C: Ngày */}
        {hasDateRange && (
          <div className="flex flex-col gap-y-1.5">
            <span className="text-xs font-semibold text-neutral-600 pl-0.5">
              Ngày
            </span>
            <div className="flex items-center gap-x-2">
              {hasDueDate && (
                <Hint description={data.isCompleted ? "Đánh dấu chưa hoàn thành" : "Đánh dấu hoàn thành"} side="bottom">
                  <input
                    type="checkbox"
                    checked={data.isCompleted}
                    onChange={onToggleComplete}
                    disabled={isLoadingUpdate}
                    className="h-4.5 w-4.5 rounded-sm border-neutral-300 accent-violet-600 cursor-pointer shadow-xs"
                    aria-label={data.isCompleted ? "Đánh dấu chưa hoàn thành" : "Đánh dấu hoàn thành"}
                  />
                </Hint>
              )}

              <Popover open={isDateOpen} onOpenChange={setIsDateOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex h-8 max-w-full items-center gap-x-1.5 rounded-lg border border-neutral-200 bg-neutral-50/50 hover:bg-neutral-50 active:bg-neutral-100 px-3 text-xs font-medium text-neutral-700 cursor-pointer transition-colors shadow-xs"
                  >
                    <span className="truncate">{dateSummary}</span>
                    
                    {data.isCompleted ? (
                      <span className="shrink-0 bg-emerald-600 text-white px-1.5 py-0.5 rounded text-[10px] font-bold">
                        Hoàn thành
                      </span>
                    ) : status === "overdue" ? (
                      <span className="shrink-0 bg-red-600 text-white px-1.5 py-0.5 rounded text-[10px] font-bold">
                        Quá hạn
                      </span>
                    ) : status === "warning" ? (
                      <span className="shrink-0 bg-yellow-500 text-white px-1.5 py-0.5 rounded text-[10px] font-bold">
                        Sắp hết hạn
                      </span>
                    ) : null}

                    <ChevronDown className="h-3.5 w-3.5 text-neutral-500 ml-0.5" />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-[300px] p-3 rounded-xl border border-neutral-200 shadow-xl bg-white z-[9999]" sideOffset={6}>
                  <div className="relative pb-2.5 mb-3 border-b border-neutral-100 flex items-center justify-between">
                    <span className="text-sm font-semibold text-neutral-700 mx-auto">Ngày</span>
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
                        Ngày và giờ bắt đầu
                      </span>
                      <input
                        name="startDate"
                        aria-label="Ngày và giờ bắt đầu"
                        type="datetime-local"
                        value={startDateValue}
                        onChange={(event) => setStartDateValue(event.target.value)}
                        disabled={isLoadingUpdate}
                        className="h-9 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-700 shadow-xs outline-none transition focus:border-violet-500 focus:ring-1 focus:ring-violet-200"
                      />
                    </div>
                    <div className="flex flex-col gap-y-1">
                      <span className="text-[11px] font-bold text-neutral-500 uppercase">
                        Ngày và giờ hết hạn
                      </span>
                      <input
                        name="dueDate"
                        aria-label="Ngày và giờ hết hạn"
                        type="datetime-local"
                        value={dueDateValue}
                        onChange={(event) => {
                          setDueDateValue(event.target.value);
                          if (!event.target.value) {
                            setReminderValue("none");
                          }
                        }}
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
                        aria-label="Thiết lập nhắc nhở"
                        value={reminderValue}
                        onChange={(event) => setReminderValue(event.target.value)}
                        disabled={isLoadingUpdate || !canSetReminder}
                        className="h-9 w-full rounded-lg border border-neutral-200 bg-white px-2.5 text-sm text-neutral-700 shadow-xs outline-none transition focus:border-violet-500 focus:ring-1 focus:ring-violet-200 disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-400 cursor-pointer"
                      >
                        <option value="none">Không có</option>
                        <option value="0">Vào thời điểm hết hạn</option>
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
                      {hasStartDate && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={isLoadingUpdate}
                          onClick={() => updateStartDate(null)}
                          className="h-8 rounded-lg text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 text-xs px-3"
                          aria-label="Xóa ngày bắt đầu"
                        >
                          Xóa bắt đầu
                        </Button>
                      )}
                      {hasDueDate && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={isLoadingUpdate}
                          onClick={() => updateDueDate(null)}
                          className="h-8 rounded-lg text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 text-xs px-3"
                          aria-label="Xóa ngày hết hạn"
                        >
                          Xóa hết hạn
                        </Button>
                      )}
                    </div>
                  </form>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        )}
      </div>
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
