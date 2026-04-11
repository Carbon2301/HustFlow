"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, CalendarDays, ChartGantt, Columns3, LayoutPanelLeft } from "lucide-react";

import { cn } from "@/lib/utils";

interface BoardViewSwitcherProps {
  boardId: string;
}

export const BoardViewSwitcher = ({ boardId }: BoardViewSwitcherProps) => {
  const pathname = usePathname();
  const calendarHref = `/board/${boardId}/calendar`;
  const timelineHref = `/board/${boardId}/timeline`;
  const splitHref = `/board/${boardId}/split`;
  const analyticsHref = `/board/${boardId}/analytics`;
  const boardHref = `/board/${boardId}`;
  const isBoard = pathname === boardHref;
  const isCalendar = pathname === calendarHref;
  const isTimeline = pathname === timelineHref;
  const isSplit = pathname === splitHref;
  const isAnalytics = pathname === analyticsHref;

  const views = [
    {
      href: boardHref,
      label: "Bảng",
      icon: Columns3,
      active: isBoard,
    },
    {
      href: calendarHref,
      label: "Lịch",
      icon: CalendarDays,
      active: isCalendar,
    },
    {
      href: timelineHref,
      label: "Tiến độ",
      icon: ChartGantt,
      active: isTimeline,
    },
    {
      href: splitHref,
      label: "Cả hai",
      icon: LayoutPanelLeft,
      active: isSplit,
    },
    {
      href: analyticsHref,
      label: "Thống kê",
      icon: BarChart3,
      active: isAnalytics,
    },
  ];

  return (
    <nav
      aria-label="Chế độ xem bảng"
      className="flex h-8 shrink-0 items-center rounded-lg bg-white/10 p-0.5 ring-1 ring-white/15"
    >
      {views.map((view) => {
        const Icon = view.icon;

        return (
          <Link
            key={view.href}
            href={view.href}
            aria-current={view.active ? "page" : undefined}
            title={view.label}
            className={cn(
              "inline-flex h-7 min-w-7 items-center justify-center gap-x-1.5 rounded-md px-1.5 text-xs font-semibold text-white/75 transition hover:bg-white/15 hover:text-white lg:px-2",
              view.active && "bg-white text-neutral-800 shadow-sm hover:bg-white hover:text-neutral-900",
            )}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden lg:inline">{view.label}</span>
          </Link>
        );
      })}
    </nav>
  );
};
