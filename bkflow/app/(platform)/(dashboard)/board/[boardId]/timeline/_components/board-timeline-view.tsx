"use client";

import { type CSSProperties, useMemo, useState } from "react";
import { BoardMemberRole } from "@prisma/client";
import {
  addDays,
  differenceInCalendarDays,
  eachDayOfInterval,
  eachMonthOfInterval,
  eachWeekOfInterval,
  format,
  isAfter,
  isBefore,
  isToday,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { vi } from "date-fns/locale";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock3,
  ListTree,
  UserRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { useCardModal } from "@/hooks/use-card-modal";
import { cn } from "@/lib/utils";
import type {
  BoardTimelineBoardMember,
  BoardTimelineCard,
  BoardTimelineList,
} from "@/types";

type BoardTimelineViewProps = {
  boardId: string;
  lists: BoardTimelineList[];
  boardMembers: BoardTimelineBoardMember[];
  currentUserId: string;
  currentBoardMemberId: string;
  currentMemberRole: BoardMemberRole;
};

type TimelineZoom = "day" | "week" | "month";

type TimelineUnit = {
  key: string;
  label: string;
  start: Date;
  end: Date;
};

type ScheduledCard = {
  card: BoardTimelineCard;
  start: Date;
  end: Date;
  isMilestone: boolean;
  hasInvalidRange: boolean;
};

const SIDEBAR_WIDTH = 320;
const ROW_HEIGHT = 48;
const HEADER_HEIGHT = 48;
const BAR_HEIGHT = 32;
const BAR_VERTICAL_OFFSET = (ROW_HEIGHT - BAR_HEIGHT) / 2;
const MIN_GRID_WIDTH = 520;
const GANTT_MAX_HEIGHT = "min(640px, calc(100vh - 24rem))";

const zoomLabels: Record<TimelineZoom, string> = {
  day: "Ngày",
  week: "Tuần",
  month: "Tháng",
};

const COLUMN_WIDTH_BY_ZOOM: Record<TimelineZoom, number> = {
  day: 56,
  week: 96,
  month: 120,
};

const roleLabels: Record<BoardMemberRole, string> = {
  ADMIN: "Quản trị",
  MEMBER: "Thành viên",
  VIEWER: "Chỉ xem",
};

const parseTimelineDate = (value: string | null) => {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return startOfDay(date);
};

const formatDate = (value: string | null) => {
  const date = parseTimelineDate(value);

  if (!date) {
    return "Chưa đặt";
  }

  return format(date, "dd/MM/yyyy", { locale: vi });
};

const getCardSchedule = (card: BoardTimelineCard): ScheduledCard | null => {
  const startDate = parseTimelineDate(card.startDate);
  const dueDate = parseTimelineDate(card.dueDate);

  if (!startDate && !dueDate) {
    return null;
  }

  if (startDate && dueDate) {
    return {
      card,
      start: isAfter(startDate, dueDate) ? dueDate : startDate,
      end: isAfter(startDate, dueDate) ? startDate : dueDate,
      isMilestone: false,
      hasInvalidRange: isAfter(startDate, dueDate),
    };
  }

  const singleDate = startDate ?? dueDate;

  if (!singleDate) {
    return null;
  }

  return {
    card,
    start: singleDate,
    end: startDate && !dueDate ? addDays(singleDate, 1) : singleDate,
    isMilestone: !startDate || !dueDate,
    hasInvalidRange: false,
  };
};

const getUnitForDate = (units: TimelineUnit[], date: Date) => {
  const index = units.findIndex((unit) => (
    !isBefore(date, unit.start) && !isAfter(date, unit.end)
  ));

  if (index === -1) {
    return date.getTime() < units[0]?.start.getTime()
      ? 0
      : Math.max(0, units.length - 1);
  }

  return index;
};

const getTimelinePlacement = (
  row: ScheduledCard,
  units: TimelineUnit[],
  columnWidth: number,
) => {
  const startIndex = getUnitForDate(units, row.start);
  const endIndex = getUnitForDate(units, row.end);
  const orderedStartIndex = Math.min(startIndex, endIndex);
  const orderedEndIndex = Math.max(startIndex, endIndex);
  const span = Math.max(1, orderedEndIndex - orderedStartIndex + 1);
  const left = orderedStartIndex * columnWidth;
  const width = span * columnWidth;

  return {
    startIndex: orderedStartIndex,
    endIndex: orderedEndIndex,
    span,
    left,
    width,
  };
};

const getTimelineUnits = (
  start: Date,
  end: Date,
  zoom: TimelineZoom,
): TimelineUnit[] => {
  if (zoom === "day") {
    return eachDayOfInterval({ start, end }).map((date) => ({
      key: format(date, "yyyy-MM-dd"),
      label: format(date, "dd/MM", { locale: vi }),
      start: date,
      end: date,
    }));
  }

  if (zoom === "week") {
    return eachWeekOfInterval(
      { start, end },
      { weekStartsOn: 1 },
    ).map((date) => ({
      key: `week:${format(date, "yyyy-MM-dd")}`,
      label: `Tuần ${format(date, "dd/MM", { locale: vi })}`,
      start: startOfWeek(date, { weekStartsOn: 1 }),
      end: addDays(startOfWeek(date, { weekStartsOn: 1 }), 6),
    }));
  }

  return eachMonthOfInterval({ start, end }).map((date) => ({
    key: `month:${format(date, "yyyy-MM")}`,
    label: format(date, "MM/yyyy", { locale: vi }),
    start: startOfMonth(date),
    end: addDays(startOfMonth(new Date(date.getFullYear(), date.getMonth() + 1, 1)), -1),
  }));
};

const getTimelineBounds = (cards: ScheduledCard[]) => {
  if (cards.length === 0) {
    const today = startOfDay(new Date());

    return {
      start: today,
      end: addDays(today, 30),
    };
  }

  const starts = cards.map((item) => item.start.getTime());
  const ends = cards.map((item) => item.end.getTime());

  return {
    start: addDays(new Date(Math.min(...starts)), -7),
    end: addDays(new Date(Math.max(...ends)), 7),
  };
};

const isCardOverdue = (card: BoardTimelineCard) => {
  const dueDate = parseTimelineDate(card.dueDate);

  return Boolean(dueDate && isBefore(dueDate, startOfDay(new Date())) && !card.isCompleted);
};

const getCardTimelineTitle = (row: ScheduledCard) => {
  const prefix = row.hasInvalidRange ? "Khoảng ngày cần kiểm tra: " : "";

  if (row.isMilestone) {
    return `${prefix}${row.card.title} - Mốc ${formatDate(row.card.startDate ?? row.card.dueDate)}`;
  }

  return `${prefix}${row.card.title} - ${formatDate(row.card.startDate)} đến ${formatDate(row.card.dueDate)}`;
};

const getCardTone = (card: BoardTimelineCard, hasInvalidRange: boolean) => {
  if (hasInvalidRange) {
    return "border-orange-300 bg-orange-100 text-orange-900";
  }

  if (card.isCompleted) {
    return "border-emerald-200 bg-emerald-100 text-emerald-800";
  }

  if (isCardOverdue(card)) {
    return "border-rose-300 bg-rose-100 text-rose-800";
  }

  if (card.unresolvedBlockerCount > 0) {
    return "border-amber-300 bg-amber-100 text-amber-900";
  }

  return "border-blue-300 bg-blue-100 text-blue-800";
};

const getDependencyConflicts = (card: BoardTimelineCard) => {
  const blockeeStart = parseTimelineDate(card.startDate);

  if (!blockeeStart) {
    return [];
  }

  return card.blockedByDependencies.filter((blocker) => {
    const blockerDue = parseTimelineDate(blocker.dueDate);

    return Boolean(blockerDue && !blocker.isCompleted && isAfter(blockerDue, blockeeStart));
  });
};

const getDependencyPreview = (card: BoardTimelineCard) => {
  const conflictCount = getDependencyConflicts(card).length;

  return {
    unresolvedBlockerCount: card.unresolvedBlockerCount,
    conflictCount,
    hasBlockers: card.unresolvedBlockerCount > 0,
    hasConflict: conflictCount > 0,
  };
};

const getDependencyPreviewLabel = (card: BoardTimelineCard) => {
  const preview = getDependencyPreview(card);
  const parts = [];

  if (preview.hasBlockers) {
    parts.push(`${preview.unresolvedBlockerCount} thẻ chặn chưa hoàn thành`);
  }

  if (preview.hasConflict) {
    parts.push(`${preview.conflictCount} xung đột lịch phụ thuộc`);
  }

  return parts.join(". ");
};

const getUnscheduledCardMeta = (card: BoardTimelineCard) => {
  const meta = [];

  if (card.assignees.length > 0) {
    meta.push(`${card.assignees.length} thành viên`);
  }

  if (card.checklistProgress.total > 0) {
    meta.push(`${card.checklistProgress.completed}/${card.checklistProgress.total} checklist`);
  }

  if (card.commentCount > 0) {
    meta.push(`${card.commentCount} bình luận`);
  }

  if (card.attachmentCount > 0) {
    meta.push(`${card.attachmentCount} tệp`);
  }

  return meta;
};

const StatBlock = ({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  tone: string;
}) => (
  <div className="rounded-lg border border-neutral-200 bg-white p-4 shadow-xs">
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-xs font-medium uppercase text-neutral-500">{label}</p>
        <p className="mt-1 text-2xl font-semibold text-neutral-950">{value}</p>
      </div>
      <div className={cn("flex h-9 w-9 items-center justify-center rounded-md", tone)}>
        <Icon className="h-4 w-4" />
      </div>
    </div>
  </div>
);

const TimelineToolbar = ({
  zoom,
  onZoomChange,
}: {
  zoom: TimelineZoom;
  onZoomChange: (zoom: TimelineZoom) => void;
}) => (
  <div className="flex items-center gap-1 rounded-lg border border-neutral-200 bg-white p-1">
    {(Object.keys(zoomLabels) as TimelineZoom[]).map((option) => (
      <button
        key={option}
        type="button"
        onClick={() => onZoomChange(option)}
        className={cn(
          "h-8 rounded-md px-3 text-xs font-semibold text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-950",
          zoom === option && "bg-neutral-900 text-white hover:bg-neutral-900 hover:text-white",
        )}
      >
        {zoomLabels[option]}
      </button>
    ))}
  </div>
);

const DependencyPreviewBadge = ({
  card,
  className,
  style,
}: {
  card: BoardTimelineCard;
  className?: string;
  style?: CSSProperties;
}) => {
  const preview = getDependencyPreview(card);

  if (!preview.hasBlockers && !preview.hasConflict) {
    return null;
  }

  const label = getDependencyPreviewLabel(card);

  return (
    <span
      title={label}
      aria-label={label}
      className={cn(
        "inline-flex h-5 shrink-0 items-center gap-1 rounded-md px-1.5 text-xs font-semibold",
        preview.hasConflict
          ? "bg-rose-50 text-rose-600 ring-1 ring-rose-200"
          : "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
        className,
      )}
      style={style}
    >
      {preview.hasConflict && <AlertTriangle className="h-3 w-3" aria-hidden="true" />}
      <span>{preview.unresolvedBlockerCount}</span>
      {preview.hasConflict && (
        <span className="sr-only">, {preview.conflictCount} xung dot lich phu thuoc</span>
      )}
    </span>
  );
};

const TimelineSidebar = ({
  rows,
  onOpenCard,
}: {
  rows: ScheduledCard[];
  onOpenCard: (cardId: string) => void;
}) => (
  <aside
    className="sticky left-0 z-20 shrink-0 border-r border-neutral-200 bg-white shadow-[8px_0_16px_rgba(15,23,42,0.04)]"
    style={{ width: SIDEBAR_WIDTH }}
  >
    <div
      className="sticky top-0 z-30 flex items-center border-b border-neutral-200 bg-white px-3 text-xs font-semibold uppercase text-neutral-500"
      style={{ height: HEADER_HEIGHT }}
    >
      Thẻ
    </div>
    <div>
      {rows.map(({ card }) => (
        <button
          key={card.id}
          type="button"
          onClick={() => onOpenCard(card.id)}
          className="flex w-full items-center justify-between gap-3 border-b border-neutral-100 px-3 text-left transition hover:bg-neutral-50"
          style={{ height: ROW_HEIGHT }}
        >
          <div className="min-w-0">
            <p className={cn(
              "truncate text-sm font-medium text-neutral-900",
              card.isCompleted && "text-neutral-500 line-through",
            )}>
              {card.title}
            </p>
            <p className="truncate text-xs text-neutral-500">{card.listTitle}</p>
          </div>
          <DependencyPreviewBadge card={card} />
        </button>
      ))}
    </div>
  </aside>
);

const TimelineGrid = ({
  rows,
  units,
  zoom,
  onOpenCard,
}: {
  rows: ScheduledCard[];
  units: TimelineUnit[];
  zoom: TimelineZoom;
  onOpenCard: (cardId: string) => void;
}) => {
  const columnWidth = COLUMN_WIDTH_BY_ZOOM[zoom];
  const gridWidth = Math.max(units.length * columnWidth, MIN_GRID_WIDTH);

  return (
    <div className="min-w-0 flex-1">
      <div
        className="sticky top-0 z-10 grid border-b border-neutral-200 bg-white"
        style={{
          height: HEADER_HEIGHT,
          width: gridWidth,
          gridTemplateColumns: `repeat(${units.length}, ${columnWidth}px)`,
        }}
      >
        {units.map((unit) => (
          <div
            key={unit.key}
            className={cn(
              "flex items-center border-r border-neutral-200 px-2 text-xs font-semibold text-neutral-500",
              isToday(unit.start) && "bg-blue-50 text-blue-700",
            )}
          >
            {unit.label}
          </div>
        ))}
      </div>
      <div style={{ width: gridWidth }}>
        {rows.map((row) => {
          const placement = getTimelinePlacement(row, units, columnWidth);
          const tone = getCardTone(row.card, row.hasInvalidRange);
          const title = getCardTimelineTitle(row);

          return (
            <div
              key={row.card.id}
              className="relative border-b border-neutral-100 bg-white"
              style={{ height: ROW_HEIGHT }}
            >
              <div
                aria-hidden="true"
                className="absolute inset-0 grid"
                style={{ gridTemplateColumns: `repeat(${units.length}, ${columnWidth}px)` }}
              >
                {units.map((unit) => (
                  <div
                    key={unit.key}
                    className={cn(
                      "border-r border-neutral-100",
                      isToday(unit.start) && "bg-blue-50/60",
                    )}
                  />
                ))}
              </div>
              {row.isMilestone ? (
                <>
                  <button
                    type="button"
                    onClick={() => onOpenCard(row.card.id)}
                    title={title}
                    className={cn(
                      "absolute top-1/2 h-4 w-4 -translate-y-1/2 rotate-45 rounded-[3px] border shadow-sm transition hover:scale-110",
                      tone,
                    )}
                    style={{ left: placement.left + columnWidth / 2 - 8 }}
                  >
                    <span className="sr-only">{row.card.title}</span>
                  </button>
                  <DependencyPreviewBadge
                    card={row.card}
                    className="absolute top-1/2 -translate-y-1/2"
                    style={{ left: placement.left + columnWidth / 2 + 12 }}
                  />
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => onOpenCard(row.card.id)}
                  title={title}
                  className={cn(
                    "absolute flex items-center gap-1.5 overflow-hidden rounded-md border px-2 text-left text-xs font-semibold shadow-sm transition hover:shadow-md",
                    tone,
                  )}
                  style={{
                    top: BAR_VERTICAL_OFFSET,
                    height: BAR_HEIGHT,
                    left: placement.left + 6,
                    width: Math.max(36, placement.width - 12),
                  }}
                >
                  <span className="truncate">{row.card.title}</span>
                  {row.hasInvalidRange && <AlertTriangle className="h-3 w-3 shrink-0" />}
                  <DependencyPreviewBadge card={row.card} className="ml-auto" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const EmptyTimeline = ({ hasCards }: { hasCards: boolean }) => (
  <div className="flex min-h-[320px] items-center justify-center rounded-lg border border-dashed border-neutral-300 bg-white p-6 text-center">
    <div>
      <CalendarClock className="mx-auto h-10 w-10 text-neutral-300" />
      <h2 className="mt-3 text-base font-semibold text-neutral-900">
        {hasCards ? "Chưa có thẻ có mốc thời gian" : "Chưa có thẻ để hiển thị"}
      </h2>
      <p className="mt-1 max-w-md text-sm text-neutral-500">
        {hasCards
          ? "Các thẻ chưa lên lịch được gom ở phần bên dưới để chuẩn bị kéo vào timeline ở phase sau."
          : "Khi board có thẻ, timeline sẽ dùng dữ liệu ngày, nhãn, thành viên và phụ thuộc tại đây."}
      </p>
    </div>
  </div>
);

const UnscheduledSection = ({
  cards,
  onOpenCard,
}: {
  cards: BoardTimelineCard[];
  onOpenCard: (cardId: string) => void;
}) => (
  <section className="mt-4 rounded-lg border border-neutral-200 bg-white">
    <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
      <div>
        <h2 className="text-sm font-semibold text-neutral-900">Chưa lên lịch</h2>
        <p className="mt-1 text-xs text-neutral-500">Thẻ chưa có ngày bắt đầu và hạn hoàn thành.</p>
      </div>
      <span className="rounded-md bg-neutral-100 px-2 py-1 text-xs font-semibold text-neutral-600">
        {cards.length}
      </span>
    </div>
    {cards.length === 0 ? (
      <p className="px-4 py-4 text-sm text-neutral-400">Không có thẻ chưa lên lịch.</p>
    ) : (
      <div className="grid gap-2 p-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <button
            key={card.id}
            type="button"
            onClick={() => onOpenCard(card.id)}
            title={`Mở thẻ: ${card.title}`}
            aria-label={`Mở thẻ: ${card.title}`}
            className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-left transition hover:border-neutral-300 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className={cn(
                  "truncate text-sm font-semibold text-neutral-900",
                  card.isCompleted && "text-neutral-500 line-through",
                )}>
                  {card.title}
                </p>
                <p className="mt-1 truncate text-xs text-neutral-500">{card.listTitle}</p>
              </div>
              <DependencyPreviewBadge card={card} />
            </div>
            {getUnscheduledCardMeta(card).length > 0 && (
              <p className="mt-2 truncate text-xs text-neutral-500">
                {getUnscheduledCardMeta(card).join(" • ")}
              </p>
            )}
            {card.labels.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {card.labels.slice(0, 4).map((label) => (
                  <span
                    key={label.id}
                    className="h-1.5 w-8 rounded-full"
                    style={{ backgroundColor: label.color }}
                    title={label.title}
                  />
                ))}
              </div>
            )}
          </button>
        ))}
      </div>
    )}
  </section>
);

export const BoardTimelineView = ({
  boardId,
  lists,
  boardMembers,
  currentUserId,
  currentBoardMemberId,
  currentMemberRole,
}: BoardTimelineViewProps) => {
  const [zoom, setZoom] = useState<TimelineZoom>("day");
  const cardModal = useCardModal();
  const currentMember = boardMembers.find((member) => member.userId === currentUserId);
  const derived = useMemo(() => {
    const allCards = lists.flatMap((list) => list.cards);
    const scheduledCards = allCards
      .map(getCardSchedule)
      .filter((item): item is ScheduledCard => Boolean(item))
      .sort((left, right) => {
        const startDelta = differenceInCalendarDays(left.start, right.start);

        if (startDelta !== 0) {
          return startDelta;
        }

        return left.card.listOrder - right.card.listOrder ||
          left.card.order - right.card.order;
      });
    const unscheduledCards = allCards
      .filter((card) => !card.startDate && !card.dueDate)
      .sort((left, right) => left.listOrder - right.listOrder || left.order - right.order);
    const bounds = getTimelineBounds(scheduledCards);
    const units = getTimelineUnits(bounds.start, bounds.end, zoom);

    return {
      allCards,
      scheduledCards,
      unscheduledCards,
      timelineStart: bounds.start,
      timelineEnd: bounds.end,
      units,
      stats: {
        totalCards: allCards.length,
        scheduledCards: scheduledCards.length,
        unscheduledCards: unscheduledCards.length,
        completedCards: allCards.filter((card) => card.isCompleted).length,
        blockedCards: allCards.filter((card) => card.unresolvedBlockerCount > 0).length,
      },
    };
  }, [lists, zoom]);
  const hasCards = derived.stats.totalCards > 0;
  const hasScheduledCards = derived.scheduledCards.length > 0;

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50 text-neutral-950 shadow-sm">
      <header className="flex shrink-0 flex-col gap-4 border-b border-neutral-200 bg-white p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase text-neutral-500">Board {boardId.slice(0, 8)}</p>
          <h1 className="mt-1 text-xl font-semibold text-neutral-950">Tiến độ</h1>
          <p className="mt-1 text-sm text-neutral-600">
            {format(derived.timelineStart, "dd/MM/yyyy", { locale: vi })} - {format(derived.timelineEnd, "dd/MM/yyyy", { locale: vi })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-neutral-600">
          <span className="inline-flex h-8 items-center gap-1.5 rounded-md border border-neutral-200 bg-neutral-50 px-2.5">
            <UserRound className="h-3.5 w-3.5" />
            {currentMember?.userName ?? "Thành viên"}
          </span>
          <span className="inline-flex h-8 items-center rounded-md border border-neutral-200 bg-neutral-50 px-2.5">
            {roleLabels[currentMemberRole]}
          </span>
          <span className="inline-flex h-8 items-center rounded-md border border-neutral-200 bg-neutral-50 px-2.5">
            #{currentBoardMemberId.slice(0, 8)}
          </span>
          <TimelineToolbar zoom={zoom} onZoomChange={setZoom} />
        </div>
      </header>

      <div className="grid shrink-0 grid-cols-1 gap-3 border-b border-neutral-200 bg-neutral-50 p-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatBlock
          label="Tổng thẻ"
          value={derived.stats.totalCards}
          icon={ListTree}
          tone="bg-blue-50 text-blue-600"
        />
        <StatBlock
          label="Có lịch"
          value={derived.stats.scheduledCards}
          icon={CalendarClock}
          tone="bg-emerald-50 text-emerald-600"
        />
        <StatBlock
          label="Chưa lên lịch"
          value={derived.stats.unscheduledCards}
          icon={Clock3}
          tone="bg-amber-50 text-amber-600"
        />
        <StatBlock
          label="Hoàn thành"
          value={derived.stats.completedCards}
          icon={CheckCircle2}
          tone="bg-teal-50 text-teal-600"
        />
        <StatBlock
          label="Đang bị chặn"
          value={derived.stats.blockedCards}
          icon={AlertTriangle}
          tone="bg-rose-50 text-rose-600"
        />
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-4">
        {!hasScheduledCards ? (
          <EmptyTimeline hasCards={hasCards} />
        ) : (
          <div
            className="overflow-auto rounded-lg border border-neutral-200 bg-white"
            style={{ maxHeight: GANTT_MAX_HEIGHT }}
          >
            <div className="flex min-w-max">
              <TimelineSidebar
                rows={derived.scheduledCards}
                onOpenCard={cardModal.onOpen}
              />
              <TimelineGrid
                rows={derived.scheduledCards}
                units={derived.units}
                zoom={zoom}
                onOpenCard={cardModal.onOpen}
              />
            </div>
          </div>
        )}

        {hasCards && (
          <UnscheduledSection
            cards={derived.unscheduledCards}
            onOpenCard={cardModal.onOpen}
          />
        )}
      </div>
    </section>
  );
};
