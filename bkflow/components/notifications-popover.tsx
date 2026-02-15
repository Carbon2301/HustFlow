"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  CheckSquare,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock,
  LayoutDashboard,
  LayoutList,
  MessageSquareReply,
  KanbanSquare,
  UserPlus,
  Users,
} from "lucide-react";
import { format, formatDistanceToNow, isPast } from "date-fns";
import { vi } from "date-fns/locale";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Hint } from "@/components/hint";
import { cn, formatNotificationText } from "@/lib/utils";
import { useCardModal } from "@/hooks/use-card-modal";
import { useNotifications } from "@/hooks/use-notifications";
import { NotificationItem } from "@/components/notifications/types";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

const getNotificationIcon = (type: NotificationItem["type"]) => {
  switch (type) {
    case "CARD_ASSIGNED":
      return Users;
    case "CHECKLIST_ITEM_ASSIGNED":
      return CheckSquare;
    case "BOARD_INVITE":
      return UserPlus;
    case "COMMENT_REPLY":
    case "COMMENT_MENTION":
      return MessageSquareReply;
    case "CARD_REMINDER":
      return Clock;
    default:
      return Bell;
  }
};

const formatDueDate = (dateStr: string | null) => {
  if (!dateStr) {
    return "";
  }

  try {
    return format(new Date(dateStr), "dd/MM/yyyy 'lúc' HH:mm", {
      locale: vi,
    });
  } catch {
    return "";
  }
};

const formatReminderStatus = (dueDateStr: string | null) => {
  if (!dueDateStr) {
    return { text: "", overdue: false };
  }

  try {
    const due = new Date(dueDateStr);
    const overdue = isPast(due);
    const relative = formatDistanceToNow(due, { locale: vi });
    if (overdue) {
      return { text: `Quá hạn ${relative} trước`, overdue: true };
    }
    return { text: `Còn ${relative} nữa đến hạn`, overdue: false };
  } catch {
    return { text: "", overdue: false };
  }
};

export const NotificationsPopover = () => {
  const router = useRouter();
  const cardModal = useCardModal();
  const queryClient = useQueryClient();
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
    ? notifications.filter((notification) => !notification.readAt)
    : notifications;

  const totalPages = Math.ceil(filteredNotifications.length / itemsPerPage);
  const paginatedNotifications = filteredNotifications.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  const toggleReadStatus = (
    event: React.MouseEvent,
    id: string,
    notificationIsRead: boolean,
  ) => {
    event.stopPropagation();
    if (notificationIsRead) {
      markAsUnread(id);
      return;
    }

    markAsRead(id);
  };

  const handleClickNotification = async (
    notification: NotificationItem,
    notificationIsRead: boolean,
  ) => {
    if (!notificationIsRead) {
      markAsRead(notification.id);
    }

    setOpen(false);

    if (notification.cardId) {
      const toastId = toast.loading("Đang mở thẻ...");
      try {
        const response = await fetch(`/api/cards/${notification.cardId}`);
        if (!response.ok) {
          if (response.status === 404) {
            toast.error("Thẻ không tồn tại hoặc đã bị xóa.", { id: toastId });
          } else if (response.status === 403) {
            toast.error("Bạn không có quyền truy cập thẻ này.", { id: toastId });
          } else {
            toast.error("Có lỗi xảy ra khi tải dữ liệu thẻ.", { id: toastId });
          }
          return;
        }

        const data = await response.json();
        queryClient.setQueryData(["card", notification.cardId], data);
        toast.dismiss(toastId);
        cardModal.onOpen(notification.cardId);
      } catch (err) {
        toast.error("Có lỗi xảy ra khi tải dữ liệu thẻ.", { id: toastId });
      }
      return;
    }

    if (notification.boardId) {
      router.push(`/board/${notification.boardId}`);
    }
  };

  const getPageNumbers = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, index) => index + 1);
    }

    const pages: (number | "...")[] = [1];
    if (currentPage > 3) pages.push("...");
    for (
      let page = Math.max(2, currentPage - 1);
      page <= Math.min(totalPages - 1, currentPage + 1);
      page++
    ) {
      pages.push(page);
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
          className="relative h-8 w-8 rounded-lg text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
        >
          <Bell className="h-4.5 w-4.5" />
          {hasUnread && (
            <span className="absolute right-1.5 top-1.5 flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-600" />
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={10}
        className="flex w-[420px] flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white p-0 shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-neutral-100 bg-neutral-50/50 px-5 py-4">
          <h3 className="text-lg font-semibold text-neutral-800">
            Thông báo
          </h3>
          <div className="flex items-center gap-x-4">
            {hasUnread && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="flex items-center gap-x-1 text-xs font-semibold text-violet-600 outline-hidden hover:text-violet-700 hover:underline"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Đọc tất cả
              </button>
            )}
            <label className="flex cursor-pointer select-none items-center gap-x-2.5 text-xs font-medium text-neutral-500">
              Chưa đọc
              <button
                type="button"
                onClick={() => {
                  setOnlyUnread(!onlyUnread);
                  setCurrentPage(1);
                }}
                className={cn(
                  "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent outline-hidden transition-colors duration-200 ease-in-out",
                  onlyUnread ? "bg-emerald-600" : "bg-neutral-200",
                )}
              >
                <span
                  className={cn(
                    "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out",
                    onlyUnread ? "translate-x-4" : "translate-x-0",
                  )}
                />
              </button>
            </label>
          </div>
        </div>

        <div className="flex min-h-[300px] flex-1 flex-col justify-between p-4">
          {isLoading ? (
            <div className="my-auto flex flex-col gap-y-3">
              {[1, 2, 3].map((index) => (
                <div
                  key={index}
                  className="h-[88px] animate-pulse rounded-xl bg-neutral-100"
                />
              ))}
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="my-auto flex flex-col items-center justify-center py-8 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-neutral-100 text-neutral-400">
                <Bell className="h-7 w-7" />
              </div>
              <p className="text-[15px] font-semibold text-neutral-800">
                {onlyUnread ? "Không có thông báo chưa đọc" : "Không có thông báo"}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-y-3">
              <ul className="space-y-2.5">
                {paginatedNotifications.map((notification) => {
                  const notificationIsRead = isRead(notification.id);
                  const Icon = getNotificationIcon(notification.type);
                  const formatted = formatNotificationText(notification.title, notification.message);
                  const isReminder = notification.type === "CARD_REMINDER";
                  const { text: reminderText, overdue } = formatReminderStatus(
                    notification.dueDate,
                  );

                  return (
                    <li
                      key={notification.id}
                      onClick={() =>
                        handleClickNotification(notification, notificationIsRead)
                      }
                      className={cn(
                        "group/notif relative cursor-pointer rounded-xl border p-3 transition-all duration-150",
                        !notificationIsRead
                          ? "border-blue-100 bg-blue-50/50 shadow-sm hover:bg-blue-50"
                          : "border-neutral-100 bg-white hover:bg-neutral-50",
                      )}
                    >
                      <div className="flex items-start justify-between gap-x-2">
                        <div className="flex min-w-0 items-start gap-x-2">
                          <span
                            className={cn(
                              "inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg",
                              !notificationIsRead
                                ? "bg-blue-100 text-blue-600"
                                : "bg-neutral-100 text-neutral-500",
                            )}
                          >
                            <Icon className="h-4 w-4" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-neutral-900">
                              {formatted.title}
                            </p>
                            {!isReminder ? (
                              <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-neutral-600">
                                {formatted.message}
                              </p>
                            ) : (
                              <div className="mt-1 space-y-1.5">
                                <div className="flex items-center gap-x-1.5 text-[12px] text-neutral-500">
                                  <Clock className="h-3 w-3 flex-shrink-0 text-rose-400" />
                                  <span>
                                    Hết hạn:{" "}
                                    <span className="font-medium text-rose-500">
                                      {formatDueDate(notification.dueDate)}
                                    </span>
                                  </span>
                                </div>

                                <div className="flex flex-wrap items-center gap-x-1.5 text-[12px] text-neutral-500">
                                  {notification.boardTitle && (
                                    <>
                                      <LayoutDashboard className="h-3 w-3 flex-shrink-0 text-violet-400" />
                                      <span className="truncate font-medium text-violet-600">
                                        {notification.boardTitle}
                                      </span>
                                    </>
                                  )}
                                  {notification.listTitle && (
                                    <>
                                      <span className="text-neutral-300">/</span>
                                      <LayoutList className="h-3 w-3 flex-shrink-0 text-neutral-400" />
                                      <span className="truncate font-medium text-neutral-700">
                                        {notification.listTitle}
                                      </span>
                                    </>
                                  )}
                                  {notification.cardTitle && (
                                    <>
                                      <span className="text-neutral-300">/</span>
                                      <KanbanSquare className="h-3 w-3 flex-shrink-0 text-neutral-400" />
                                      <span className="truncate">{notification.cardTitle}</span>
                                    </>
                                  )}
                                </div>

                                {reminderText && (
                                  <div
                                    className={cn(
                                      "inline-flex items-center gap-x-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium",
                                      overdue
                                        ? "border-red-100 bg-red-50 text-red-600"
                                        : "border-amber-100 bg-amber-50 text-amber-600",
                                    )}
                                  >
                                    <Clock className="h-2.5 w-2.5" />
                                    {reminderText}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-shrink-0 items-center gap-x-2">
                          <span className="whitespace-nowrap text-[11px] text-neutral-400">
                            {formatDistanceToNow(
                              new Date(notification.triggerTime || notification.createdAt),
                              {
                                addSuffix: true,
                                locale: vi,
                              },
                            )}
                          </span>
                          <Hint
                            description={
                              notificationIsRead
                                ? "Đánh dấu là chưa đọc"
                                : "Đánh dấu là đã đọc"
                            }
                            side="left"
                            sideOffset={6}
                          >
                            <button
                              type="button"
                              onClick={(event) =>
                                toggleReadStatus(
                                  event,
                                  notification.id,
                                  notificationIsRead,
                                )
                              }
                              className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full transition-colors hover:bg-neutral-200/80"
                              aria-label={
                                notificationIsRead
                                  ? "Đánh dấu là chưa đọc"
                                  : "Đánh dấu là đã đọc"
                              }
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

                      {!isReminder && (notification.boardTitle || notification.cardTitle) && (
                        <div className="mt-2 flex flex-wrap items-center gap-x-1.5 pl-10 text-[12px] text-neutral-500">
                          {notification.boardTitle && (
                            <>
                              <LayoutDashboard className="h-3 w-3 flex-shrink-0 text-violet-400" />
                              <span className="truncate font-medium text-violet-600">
                                {notification.boardTitle}
                              </span>
                            </>
                          )}
                          {notification.listTitle && (
                            <>
                              <span className="text-neutral-300">/</span>
                              <LayoutList className="h-3 w-3 flex-shrink-0 text-neutral-400" />
                              <span className="truncate font-medium text-neutral-700">
                                {notification.listTitle}
                              </span>
                            </>
                          )}
                          {notification.cardTitle && (
                            <>
                              <span className="text-neutral-300">/</span>
                              <KanbanSquare className="h-3 w-3 flex-shrink-0 text-neutral-400" />
                              <span className="truncate">{notification.cardTitle}</span>
                            </>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>

              {totalPages > 1 && (
                <div className="mt-1 flex items-center justify-center gap-x-1 border-t border-neutral-100 pt-3">
                  <Button
                    onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                    disabled={currentPage === 1}
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-lg text-neutral-600 hover:bg-neutral-100 disabled:opacity-40"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  {getPageNumbers().map((page, index) =>
                    page === "..." ? (
                      <span
                        key={`ellipsis-${index}`}
                        className="flex h-7 w-7 items-center justify-center text-xs text-neutral-400"
                      >
                        ...
                      </span>
                    ) : (
                      <Button
                        key={page}
                        onClick={() => setCurrentPage(page as number)}
                        variant="ghost"
                        size="sm"
                        className={cn(
                          "h-7 w-7 rounded-lg text-xs font-semibold",
                          page === currentPage
                            ? "bg-violet-600 text-white shadow-sm hover:bg-violet-700"
                            : "text-neutral-600 hover:bg-neutral-100",
                        )}
                      >
                        {page}
                      </Button>
                    ),
                  )}
                  <Button
                    onClick={() =>
                      setCurrentPage((page) => Math.min(totalPages, page + 1))
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
