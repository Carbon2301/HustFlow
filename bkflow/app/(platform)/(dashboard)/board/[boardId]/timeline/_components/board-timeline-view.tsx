"use client";

import { useMemo } from "react";
import { BoardMemberRole } from "@prisma/client";
import { AlertTriangle, CalendarClock, CheckCircle2, Clock3, ListTree, UserRound } from "lucide-react";

import type {
  BoardTimelineBoardMember,
  BoardTimelineList,
} from "@/types";
import { cn } from "@/lib/utils";

type BoardTimelineViewProps = {
  boardId: string;
  lists: BoardTimelineList[];
  boardMembers: BoardTimelineBoardMember[];
  currentUserId: string;
  currentBoardMemberId: string;
  currentMemberRole: BoardMemberRole;
};

const formatDate = (value: string | null) => {
  if (!value) {
    return "Chưa đặt";
  }

  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
};

const roleLabels: Record<BoardMemberRole, string> = {
  ADMIN: "Quản trị",
  MEMBER: "Thành viên",
  VIEWER: "Chỉ xem",
};

const StatBlock = ({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: typeof CalendarClock;
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

export const BoardTimelineView = ({
  boardId,
  lists,
  boardMembers,
  currentUserId,
  currentBoardMemberId,
  currentMemberRole,
}: BoardTimelineViewProps) => {
  const stats = useMemo(() => {
    const cards = lists.flatMap((list) => list.cards);

    return {
      totalCards: cards.length,
      scheduledCards: cards.filter((card) => card.startDate || card.dueDate).length,
      unscheduledCards: cards.filter((card) => !card.startDate && !card.dueDate).length,
      completedCards: cards.filter((card) => card.isCompleted).length,
      blockedCards: cards.filter((card) => card.unresolvedBlockerCount > 0).length,
    };
  }, [lists]);
  const currentMember = boardMembers.find((member) => member.userId === currentUserId);
  const hasCards = stats.totalCards > 0;

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50 text-neutral-950 shadow-sm">
      <header className="flex shrink-0 flex-col gap-4 border-b border-neutral-200 bg-white p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase text-neutral-500">Board {boardId.slice(0, 8)}</p>
          <h1 className="mt-1 text-xl font-semibold text-neutral-950">Tiến độ</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Dữ liệu timeline đã sẵn sàng cho Gantt view ở bước tiếp theo.
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
        </div>
      </header>

      <div className="grid shrink-0 grid-cols-1 gap-3 border-b border-neutral-200 bg-neutral-50 p-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatBlock
          label="Tổng thẻ"
          value={stats.totalCards}
          icon={ListTree}
          tone="bg-blue-50 text-blue-600"
        />
        <StatBlock
          label="Có lịch"
          value={stats.scheduledCards}
          icon={CalendarClock}
          tone="bg-emerald-50 text-emerald-600"
        />
        <StatBlock
          label="Chưa lên lịch"
          value={stats.unscheduledCards}
          icon={Clock3}
          tone="bg-amber-50 text-amber-600"
        />
        <StatBlock
          label="Hoàn thành"
          value={stats.completedCards}
          icon={CheckCircle2}
          tone="bg-teal-50 text-teal-600"
        />
        <StatBlock
          label="Đang bị chặn"
          value={stats.blockedCards}
          icon={AlertTriangle}
          tone="bg-rose-50 text-rose-600"
        />
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-4">
        {!hasCards ? (
          <div className="flex min-h-[360px] items-center justify-center rounded-lg border border-dashed border-neutral-300 bg-white p-6 text-center">
            <div>
              <ListTree className="mx-auto h-10 w-10 text-neutral-300" />
              <h2 className="mt-3 text-base font-semibold text-neutral-900">Chưa có thẻ để hiển thị</h2>
              <p className="mt-1 max-w-md text-sm text-neutral-500">
                Khi board có thẻ, timeline sẽ dùng dữ liệu ngày, nhãn, thành viên và phụ thuộc tại đây.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid min-w-[880px] gap-4 lg:grid-cols-[minmax(280px,360px)_1fr]">
            <div className="space-y-3">
              {lists.map((list) => (
                <section
                  key={list.id}
                  className="rounded-lg border border-neutral-200 bg-white"
                >
                  <div className="flex items-center justify-between border-b border-neutral-100 px-3 py-2">
                    <h2 className="truncate text-sm font-semibold text-neutral-900">{list.title}</h2>
                    <span className="text-xs font-medium text-neutral-500">{list.cards.length}</span>
                  </div>
                  <div className="divide-y divide-neutral-100">
                    {list.cards.length === 0 ? (
                      <p className="px-3 py-3 text-sm text-neutral-400">Không có thẻ.</p>
                    ) : list.cards.map((card) => (
                      <div key={card.id} className="px-3 py-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className={cn(
                              "truncate text-sm font-medium text-neutral-900",
                              card.isCompleted && "text-neutral-500 line-through",
                            )}>
                              {card.title}
                            </p>
                            <p className="mt-1 text-xs text-neutral-500">
                              {formatDate(card.startDate)} - {formatDate(card.dueDate)}
                            </p>
                          </div>
                          {card.unresolvedBlockerCount > 0 && (
                            <span className="shrink-0 rounded-md bg-rose-50 px-1.5 py-0.5 text-xs font-semibold text-rose-600">
                              {card.unresolvedBlockerCount}
                            </span>
                          )}
                        </div>
                        {card.labels.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {card.labels.slice(0, 3).map((label) => (
                              <span
                                key={label.id}
                                className="h-1.5 w-8 rounded-full"
                                style={{ backgroundColor: label.color }}
                                title={label.title}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>

            <div className="flex min-h-[520px] flex-col rounded-lg border border-dashed border-neutral-300 bg-white">
              <div className="border-b border-neutral-100 px-4 py-3">
                <h2 className="text-sm font-semibold text-neutral-900">Gantt canvas</h2>
                <p className="mt-1 text-xs text-neutral-500">
                  Không gian này đã nhận dữ liệu timeline và sẽ render thanh Gantt trong phase tiếp theo.
                </p>
              </div>
              <div className="flex flex-1 items-center justify-center p-6 text-center">
                <div>
                  <CalendarClock className="mx-auto h-10 w-10 text-neutral-300" />
                  <p className="mt-3 text-sm font-medium text-neutral-600">
                    {stats.scheduledCards} thẻ có mốc thời gian, {stats.unscheduledCards} thẻ chưa lên lịch.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
