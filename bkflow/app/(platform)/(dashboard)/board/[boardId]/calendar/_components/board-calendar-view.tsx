"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  addMonths,
  eachDayOfInterval,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { vi } from "date-fns/locale";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  MessageSquare,
  UsersRound,
} from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { fetcher } from "@/lib/fetcher";
import { cn } from "@/lib/utils";
import { useCardModal } from "@/hooks/use-card-modal";
import type { BoardCalendarItem, BoardCalendarResponse } from "@/types";

interface BoardCalendarViewProps {
  boardId: string;
}

type CalendarOccurrenceKind = "single" | "start" | "due" | "range";

type CalendarOccurrence = {
  id: string;
  kind: CalendarOccurrenceKind;
  date: Date;
  item: BoardCalendarItem;
};

const WEEK_DAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
const MAX_VISIBLE_DESKTOP = 3;
const MAX_VISIBLE_MOBILE = 2;

const getVisibleGridRange = (monthDate: Date) => {
  const monthStart = startOfMonth(monthDate);
  const from = startOfWeek(monthStart, { weekStartsOn: 1 });
  const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
  const to = endOfWeek(monthEnd, { weekStartsOn: 1 });

  return {
    fromIso: from.toISOString(),
    toIso: to.toISOString(),
    days: eachDayOfInterval({ start: from, end: to }),
  };
};

const getDayKey = (date: Date) => format(date, "yyyy-MM-dd");

const parseCalendarDate = (value: string | null) => {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
};

const getOccurrenceLabel = (occurrence: CalendarOccurrence) => {
  if (occurrence.kind === "start") {
    return "Bắt đầu";
  }

  if (occurrence.kind === "due") {
    return "Hết hạn";
  }

  if (occurrence.kind === "range") {
    return "Trong ngày";
  }

  return "Lịch";
};

const isOverdue = (item: BoardCalendarItem) => {
  if (!item.dueDate || item.isCompleted) {
    return false;
  }

  return new Date(item.dueDate).getTime() < Date.now();
};

const getOccurrenceTone = (occurrence: CalendarOccurrence) => {
  if (occurrence.item.isCompleted) {
    return "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100";
  }

  if (isOverdue(occurrence.item) && occurrence.kind !== "start") {
    return "border-red-200 bg-red-50 text-red-800 hover:bg-red-100";
  }

  if (occurrence.kind === "start") {
    return "border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100";
  }

  return "border-violet-200 bg-violet-50 text-violet-800 hover:bg-violet-100";
};

const getOccurrences = (items: BoardCalendarItem[]) =>
  items.reduce<CalendarOccurrence[]>((acc, item) => {
    const startDate = parseCalendarDate(item.startDate);
    const dueDate = parseCalendarDate(item.dueDate);

    if (startDate && dueDate) {
      if (isSameDay(startDate, dueDate)) {
        acc.push({
          id: `${item.cardId}:range:${getDayKey(startDate)}`,
          kind: "range",
          date: startDate,
          item,
        });
        return acc;
      }

      acc.push({
        id: `${item.cardId}:start:${getDayKey(startDate)}`,
        kind: "start",
        date: startDate,
        item,
      });
      acc.push({
        id: `${item.cardId}:due:${getDayKey(dueDate)}`,
        kind: "due",
        date: dueDate,
        item,
      });
      return acc;
    }

    const date = startDate ?? dueDate;

    if (!date) {
      return acc;
    }

    acc.push({
      id: `${item.cardId}:single:${getDayKey(date)}`,
      kind: "single",
      date,
      item,
    });

    return acc;
  }, []);

export const BoardCalendarView = ({ boardId }: BoardCalendarViewProps) => {
  const cardModal = useCardModal();
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
  const [expandedDayKey, setExpandedDayKey] = useState<string | null>(null);
  const { fromIso, toIso, days } = useMemo(
    () => getVisibleGridRange(currentMonth),
    [currentMonth],
  );

  const query = useQuery<BoardCalendarResponse>({
    queryKey: ["board-calendar", boardId, fromIso, toIso],
    queryFn: () =>
      fetcher(
        `/api/boards/${boardId}/calendar?from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}`,
      ),
  });

  const responseItems = query.data?.items;
  const items = useMemo(() => responseItems ?? [], [responseItems]);
  const occurrences = useMemo(() => getOccurrences(items), [items]);
  const occurrencesByDay = useMemo(() => {
    return occurrences.reduce<Record<string, CalendarOccurrence[]>>((acc, occurrence) => {
      const key = getDayKey(occurrence.date);
      acc[key] = [...(acc[key] ?? []), occurrence].sort((left, right) => {
        const timeDelta = left.date.getTime() - right.date.getTime();

        if (timeDelta !== 0) {
          return timeDelta;
        }

        if (left.item.isCompleted !== right.item.isCompleted) {
          return left.item.isCompleted ? 1 : -1;
        }

        return left.item.title.localeCompare(right.item.title, "vi");
      });

      return acc;
    }, {});
  }, [occurrences]);
  const expandedDayItems = expandedDayKey ? occurrencesByDay[expandedDayKey] ?? [] : [];
  const rangeLabel = `${format(new Date(fromIso), "dd/MM/yyyy", { locale: vi })} - ${format(new Date(toIso), "dd/MM/yyyy", { locale: vi })}`;
  const monthLabel = format(currentMonth, "'Tháng' M, yyyy", { locale: vi });

  const goToPreviousMonth = () => {
    setExpandedDayKey(null);
    setCurrentMonth((value) => subMonths(value, 1));
  };

  const goToNextMonth = () => {
    setExpandedDayKey(null);
    setCurrentMonth((value) => addMonths(value, 1));
  };

  const goToToday = () => {
    setExpandedDayKey(null);
    setCurrentMonth(startOfMonth(new Date()));
  };

  const renderOccurrence = (
    occurrence: CalendarOccurrence,
    className?: string,
  ) => (
    <button
      key={occurrence.id}
      type="button"
      onClick={() => cardModal.onOpen(occurrence.item.cardId)}
      title={`${occurrence.item.title} - ${occurrence.item.listTitle}`}
      className={cn(
        "group/event flex h-7 w-full min-w-0 items-center gap-x-1 rounded-md border px-1.5 text-left text-[11px] font-medium leading-none transition",
        getOccurrenceTone(occurrence),
        className,
      )}
    >
      <span className="flex min-w-0 flex-1 items-center gap-x-1">
        {occurrence.item.labels[0] && (
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: occurrence.item.labels[0].color }}
          />
        )}
        <span className="hidden shrink-0 text-[10px] font-semibold uppercase tracking-wide opacity-70 md:inline">
          {getOccurrenceLabel(occurrence)}
        </span>
        <span className="truncate">{occurrence.item.title}</span>
      </span>
      {occurrence.item.isCompleted && (
        <CheckCircle2 className="h-3 w-3 shrink-0 opacity-80" />
      )}
    </button>
  );

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-white/20 bg-white/95 shadow-xl backdrop-blur">
      <div className="flex shrink-0 flex-col gap-3 border-b border-neutral-200 px-4 py-4 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-x-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-700">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold text-neutral-900">
                {monthLabel}
              </h1>
              <p className="truncate text-xs text-neutral-500">
                {rangeLabel}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 md:items-end">
          <div className="flex h-8 shrink-0 items-center rounded-lg border border-neutral-200 bg-white p-0.5 shadow-sm">
            <button
              type="button"
              onClick={goToPreviousMonth}
              className="flex h-7 w-7 items-center justify-center rounded-md text-neutral-600 transition hover:bg-neutral-100"
              aria-label="Tháng trước"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={goToToday}
              className="h-7 rounded-md px-2 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100"
            >
              Hôm nay
            </button>
            <button
              type="button"
              onClick={goToNextMonth}
              className="flex h-7 w-7 items-center justify-center rounded-md text-neutral-600 transition hover:bg-neutral-100"
              aria-label="Tháng sau"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="grid w-full grid-cols-3 gap-2 text-xs text-neutral-600 md:w-[300px]">
            <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2">
              <p className="font-semibold text-neutral-900">{items.length}</p>
              <p className="truncate">thẻ có lịch</p>
            </div>
            <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2">
              <p className="font-semibold text-neutral-900">
                {items.filter((item) => item.isCompleted).length}
              </p>
              <p className="truncate">hoàn thành</p>
            </div>
            <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2">
              <p className="font-semibold text-neutral-900">
                {items.filter(isOverdue).length}
              </p>
              <p className="truncate">quá hạn</p>
            </div>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3 md:p-4">
        <div className="grid grid-cols-7 rounded-t-lg border border-b-0 border-neutral-200 bg-neutral-50">
          {WEEK_DAYS.map((day) => (
            <div
              key={day}
              className="border-r border-neutral-200 px-1.5 py-2 text-center text-[11px] font-semibold uppercase text-neutral-500 last:border-r-0"
            >
              {day}
            </div>
          ))}
        </div>

        {query.isLoading && (
          <div className="grid grid-cols-7 rounded-b-lg border border-neutral-200">
            {days.map((day) => (
              <div
                key={day.toISOString()}
                className="min-h-[104px] border-r border-b border-neutral-200 p-1.5 last:border-r-0 sm:min-h-[132px] md:p-2"
              >
                <Skeleton className="mb-3 h-4 w-6 rounded bg-neutral-100" />
                <Skeleton className="mb-1.5 h-7 rounded-md bg-neutral-100" />
                <Skeleton className="h-7 rounded-md bg-neutral-100" />
              </div>
            ))}
          </div>
        )}

        {query.isError && (
          <div className="flex min-h-[320px] flex-col items-center justify-center rounded-b-lg border border-red-100 bg-red-50 px-4 text-center text-red-700">
            <AlertCircle className="mb-2 h-6 w-6" />
            <p className="text-sm font-semibold">Không tải được dữ liệu lịch.</p>
            <p className="mt-1 max-w-md text-xs text-red-600">
              Vui lòng thử tải lại trang hoặc kiểm tra quyền truy cập bảng.
            </p>
          </div>
        )}

        {query.isSuccess && (
          <>
            <div className="grid grid-cols-7 rounded-b-lg border border-neutral-200 bg-white">
              {days.map((day) => {
                const dayKey = getDayKey(day);
                const dayOccurrences = occurrencesByDay[dayKey] ?? [];
                const desktopOverflow = Math.max(dayOccurrences.length - MAX_VISIBLE_DESKTOP, 0);
                const mobileOverflow = Math.max(dayOccurrences.length - MAX_VISIBLE_MOBILE, 0);

                return (
                  <div
                    key={dayKey}
                    className={cn(
                      "min-h-[104px] overflow-hidden border-r border-b border-neutral-200 bg-white p-1.5 last:border-r-0 sm:min-h-[132px] md:p-2",
                      !isSameMonth(day, currentMonth) && "bg-neutral-50/80 text-neutral-400",
                    )}
                  >
                    <div className="mb-1 flex h-6 items-center justify-between">
                      <span
                        className={cn(
                          "flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-xs font-semibold text-neutral-600",
                          !isSameMonth(day, currentMonth) && "text-neutral-400",
                          isToday(day) && "bg-violet-600 text-white",
                        )}
                      >
                        {format(day, "d")}
                      </span>
                    </div>

                    <div className="space-y-1">
                      {dayOccurrences.slice(0, MAX_VISIBLE_DESKTOP).map((occurrence, index) =>
                        renderOccurrence(
                          occurrence,
                          index >= MAX_VISIBLE_MOBILE ? "hidden sm:flex" : undefined,
                        ),
                      )}
                      {mobileOverflow > 0 && (
                        <button
                          type="button"
                          onClick={() => setExpandedDayKey(dayKey)}
                          className="flex h-6 w-full items-center rounded-md px-1.5 text-left text-[11px] font-semibold text-neutral-500 transition hover:bg-neutral-100 sm:hidden"
                        >
                          +{mobileOverflow} thẻ
                        </button>
                      )}
                      {desktopOverflow > 0 && (
                        <button
                          type="button"
                          onClick={() => setExpandedDayKey(dayKey)}
                          className="hidden h-6 w-full items-center rounded-md px-1.5 text-left text-[11px] font-semibold text-neutral-500 transition hover:bg-neutral-100 sm:flex"
                        >
                          +{desktopOverflow} thẻ
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {items.length === 0 && (
              <div className="mt-3 flex min-h-[96px] flex-col items-center justify-center rounded-lg border border-dashed border-neutral-300 bg-neutral-50 px-4 text-center">
                <CalendarDays className="mb-2 h-6 w-6 text-neutral-400" />
                <p className="text-sm font-semibold text-neutral-700">
                  Chưa có thẻ nào trong khoảng thời gian này.
                </p>
                <p className="mt-1 max-w-md text-xs text-neutral-500">
                  Các thẻ có ngày bắt đầu hoặc ngày hết hạn sẽ xuất hiện trong lưới tháng.
                </p>
              </div>
            )}

            {expandedDayKey && expandedDayItems.length > 0 && (
              <div className="mt-3 rounded-lg border border-neutral-200 bg-white p-3 shadow-sm">
                <div className="mb-2 flex items-center justify-between gap-x-2">
                  <p className="text-sm font-semibold text-neutral-800">
                    {format(new Date(`${expandedDayKey}T00:00:00`), "EEEE, dd/MM/yyyy", { locale: vi })}
                  </p>
                  <button
                    type="button"
                    onClick={() => setExpandedDayKey(null)}
                    className="rounded-md px-2 py-1 text-xs font-semibold text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-800"
                  >
                    Đóng
                  </button>
                </div>
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {expandedDayItems.map((occurrence) => (
                    <button
                      key={`expanded:${occurrence.id}`}
                      type="button"
                      onClick={() => cardModal.onOpen(occurrence.item.cardId)}
                      className="flex min-w-0 items-start gap-x-2 rounded-lg border border-neutral-200 bg-neutral-50 p-2 text-left transition hover:border-violet-200 hover:bg-violet-50"
                    >
                      <div className={cn(
                        "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
                        getOccurrenceTone(occurrence),
                      )}>
                        {occurrence.item.isCompleted ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : (
                          <Clock className="h-4 w-4" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-neutral-900">
                          {occurrence.item.title}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500">
                          <span>{getOccurrenceLabel(occurrence)}</span>
                          <span className="truncate">{occurrence.item.listTitle}</span>
                          {occurrence.item.assignees.length > 0 && (
                            <span className="inline-flex items-center gap-x-1">
                              <UsersRound className="h-3.5 w-3.5" />
                              {occurrence.item.assignees.length}
                            </span>
                          )}
                          {occurrence.item.commentCount > 0 && (
                            <span className="inline-flex items-center gap-x-1">
                              <MessageSquare className="h-3.5 w-3.5" />
                              {occurrence.item.commentCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
};
