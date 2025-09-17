"use client";

import { useState } from "react";
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  Clock,
  LayoutList,
  LayoutDashboard,
  Circle,
} from "lucide-react";
import { Hint } from "@/components/hint";
import Image from "next/image";
import { format, formatDistanceToNow, isPast } from "date-fns";
import { vi } from "date-fns/locale";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCardModal } from "@/hooks/use-card-modal";
import { useNotifications } from "@/hooks/use-notifications";
import { NotificationItem } from "@/components/notifications/types";

export const NotificationsPopover = () => {
  const cardModal = useCardModal();
  const [open, setOpen] = useState(false);
  const [onlyUnread, setOnlyUnread] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  const {
    notifications,
    isLoading,
    hasUnread,
    isRead,
    markAsRead,
    markAsUnread,
    markAllAsRead,
  } = useNotifications();

  const filteredNotifications = onlyUnread
    ? notifications.filter((n) => !isRead(n.id))
    : notifications;

  const totalPages = Math.ceil(filteredNotifications.length / itemsPerPage);

  const paginatedNotifications = filteredNotifications.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const toggleReadStatus = (e: React.MouseEvent, id: string, isRead: boolean) => {
    e.stopPropagation();
    if (isRead) {
      markAsUnread(id);
    } else {
      markAsRead(id);
    }
  };

  const handleClickNotification = (notif: NotificationItem, isRead: boolean) => {
    // Only mark as read when clicking an unread notification
    if (!isRead) {
      markAsRead(notif.id);
    }
    setOpen(false);
    cardModal.onOpen(notif.cardId);
  };

  const formatDueDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "dd/MM/yyyy 'lúc' HH:mm", {
        locale: vi,
      });
    } catch {
      return "";
    }
  };

  /** Dynamic reminder text based on current time vs dueDate */
  const formatReminderStatus = (dueDateStr: string) => {
    try {
      const due = new Date(dueDateStr);
      const overdue = isPast(due);
      const relative = formatDistanceToNow(due, { locale: vi });
      if (overdue) {
        return { text: `Đến hạn ${relative} trước`, overdue: true };
      }
      return { text: `Còn ${relative} nữa đến hạn`, overdue: false };
    } catch {
      return { text: "", overdue: false };
    }
  };

  /** Smart pagination numbers */
  const getPageNumbers = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages: (number | "...")[] = [1];
    if (currentPage > 3) pages.push("...");
    for (
      let p = Math.max(2, currentPage - 1);
      p <= Math.min(totalPages - 1, currentPage + 1);
      p++
    ) {
      pages.push(p);
    }
    if (currentPage < totalPages - 2) pages.push("...");
    pages.push(totalPages);
    return pages;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg !cursor-pointer transition-colors relative"
        >
          <Bell className="h-4.5 w-4.5" />
          {hasUnread && (
            <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600" />
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={10}
        className="w-[420px] p-0 rounded-2xl border border-neutral-200 shadow-2xl flex flex-col overflow-hidden bg-white"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 bg-neutral-50/50">
          <h3 className="font-semibold text-lg text-neutral-800">Thông báo</h3>
          <div className="flex items-center gap-x-4">
            {hasUnread && (
              <button
                onClick={markAllAsRead}
                className="text-xs text-violet-600 hover:text-violet-700 hover:underline font-semibold cursor-pointer outline-hidden"
              >
                Đọc tất cả
              </button>
            )}
            <label className="flex items-center gap-x-2.5 text-xs font-medium text-neutral-500 cursor-pointer select-none">
              Chỉ hiển thị chưa đọc
              <button
                type="button"
                onClick={() => {
                  setOnlyUnread(!onlyUnread);
                  setCurrentPage(1);
                }}
                className={cn(
                  "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-hidden",
                  onlyUnread ? "bg-emerald-600" : "bg-neutral-200"
                )}
              >
                <span
                  className={cn(
                    "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out",
                    onlyUnread ? "translate-x-4" : "translate-x-0"
                  )}
                />
              </button>
            </label>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-[300px] flex flex-col justify-between p-4">
          {isLoading ? (
            <div className="flex flex-col gap-y-3 my-auto">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-[88px] bg-neutral-100 rounded-xl animate-pulse"
                />
              ))}
            </div>
          ) : filteredNotifications.length === 0 ? (
            /* Empty State */
            <div className="flex flex-col items-center justify-center py-6 text-center my-auto">
              <div className="relative w-36 h-36 mb-4 flex items-center justify-center">
                <Image
                  src="/husky-sleeping.png"
                  alt="Không có thông báo chưa đọc"
                  fill
                  className="object-contain rounded-full"
                  sizes="144px"
                  priority
                />
              </div>
              <p className="font-semibold text-[17px] text-neutral-800">
                {onlyUnread
                  ? "Không có Thông báo chưa đọc"
                  : "Không có Thông báo nào"}
              </p>
            </div>
          ) : (
            /* Notifications List */
            <div className="flex flex-col gap-y-3">
              <ul className="space-y-2.5">
                {paginatedNotifications.map((notif) => {
                  const notificationIsRead = isRead(notif.id);
                  const { text: reminderText, overdue } = formatReminderStatus(
                    notif.dueDate
                  );

                  return (
                    <li
                      key={notif.id}
                      onClick={() => handleClickNotification(notif, notificationIsRead)}
                      className={cn(
                        "rounded-xl p-3 transition-all duration-150 relative cursor-pointer border group/notif",
                        !notificationIsRead
                          ? "bg-blue-50/50 border-blue-100 shadow-sm hover:bg-blue-50"
                          : "bg-white hover:bg-neutral-50 border-neutral-100"
                      )}
                    >
                      {/* Card title row */}
                      <div className="flex items-start justify-between gap-x-2 mb-2">
                        <div className="flex items-center gap-x-2 min-w-0">
                          <span
                            className={cn(
                              "inline-flex items-center justify-center h-7 w-7 rounded-lg flex-shrink-0",
                              !notificationIsRead
                                ? "bg-blue-100 text-blue-600"
                                : "bg-neutral-100 text-neutral-500"
                            )}
                          >
                            <Bell className="h-3.5 w-3.5" />
                          </span>
                          <span className="font-semibold text-[14px] text-neutral-900 truncate">
                            {notif.cardTitle}
                          </span>
                        </div>
                        <div className="flex items-center gap-x-2 flex-shrink-0">
                          <span className="text-[11px] text-neutral-400 whitespace-nowrap">
                            {formatDistanceToNow(new Date(notif.triggerTime), {
                              addSuffix: true,
                              locale: vi,
                            })}
                          </span>
                          {/* Toggle read/unread dot button */}
                          <Hint
                            description={notificationIsRead ? "Đánh dấu là chưa đọc" : "Đánh dấu là đã đọc"}
                            side="left"
                            sideOffset={6}
                          >
                            <button
                              onClick={(e) => toggleReadStatus(e, notif.id, notificationIsRead)}
                              className="flex-shrink-0 flex items-center justify-center w-5 h-5 rounded-full hover:bg-neutral-200/80 transition-colors cursor-pointer"
                              aria-label={notificationIsRead ? "Đánh dấu là chưa đọc" : "Đánh dấu là đã đọc"}
                            >
                              {!notificationIsRead ? (
                                <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />
                              ) : (
                                <Circle className="h-2.5 w-2.5 text-neutral-300 hover:text-neutral-500" />
                              )}
                            </button>
                          </Hint>
                        </div>
                      </div>

                      {/* Details */}
                      <div className="pl-9 space-y-1.5">
                        {/* Due date */}
                        <div className="flex items-center gap-x-1.5 text-[12px] text-neutral-500">
                          <Clock className="h-3 w-3 flex-shrink-0 text-rose-400" />
                          <span>
                            Hết hạn:{" "}
                            <span className="font-medium text-rose-500">
                              {formatDueDate(notif.dueDate)}
                            </span>
                          </span>
                        </div>

                        {/* Board & List */}
                        <div className="flex items-center gap-x-1.5 text-[12px] text-neutral-500">
                          <LayoutDashboard className="h-3 w-3 flex-shrink-0 text-violet-400" />
                          <span className="font-medium text-violet-600">
                            {notif.boardTitle}
                          </span>
                          <span className="text-neutral-300">›</span>
                          <LayoutList className="h-3 w-3 flex-shrink-0 text-neutral-400" />
                          <span>{notif.listTitle}</span>
                        </div>

                        {/* Dynamic reminder status */}
                        <div
                          className={cn(
                            "inline-flex items-center gap-x-1.5 text-[11px] font-medium rounded-full px-2 py-0.5 border",
                            overdue
                              ? "bg-red-50 text-red-600 border-red-100"
                              : "bg-amber-50 text-amber-600 border-amber-100"
                          )}
                        >
                          <Clock className="h-2.5 w-2.5" />
                          {reminderText}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-x-1 pt-3 border-t border-neutral-100 mt-1">
                  <Button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-lg text-neutral-600 hover:bg-neutral-100 disabled:opacity-40"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  {getPageNumbers().map((p, idx) =>
                    p === "..." ? (
                      <span
                        key={`ellipsis-${idx}`}
                        className="h-7 w-7 flex items-center justify-center text-xs text-neutral-400"
                      >
                        ...
                      </span>
                    ) : (
                      <Button
                        key={p}
                        onClick={() => setCurrentPage(p as number)}
                        variant="ghost"
                        size="sm"
                        className={cn(
                          "h-7 w-7 text-xs font-semibold rounded-lg",
                          p === currentPage
                            ? "bg-violet-600 text-white hover:bg-violet-700 shadow-sm"
                            : "text-neutral-600 hover:bg-neutral-100"
                        )}
                      >
                        {p}
                      </Button>
                    )
                  )}
                  <Button
                    onClick={() =>
                      setCurrentPage((p) => Math.min(totalPages, p + 1))
                    }
                    disabled={currentPage === totalPages}
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-lg text-neutral-600 hover:bg-neutral-100 disabled:opacity-40"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
