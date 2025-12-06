"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Columns3, LayoutPanelLeft } from "lucide-react";

import { cn } from "@/lib/utils";

interface BoardViewSwitcherProps {
  boardId: string;
}

export const BoardViewSwitcher = ({ boardId }: BoardViewSwitcherProps) => {
  const pathname = usePathname();
  const calendarHref = `/board/${boardId}/calendar`;
  const splitHref = `/board/${boardId}/split`;
  const boardHref = `/board/${boardId}`;
  const isBoard = pathname === boardHref;
  const isCalendar = pathname === calendarHref;
  const isSplit = pathname === splitHref;

  const views = [
    {
      href: boardHref,
      label: "Board",
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
      href: splitHref,
      label: "Cả hai",
      icon: LayoutPanelLeft,
      active: isSplit,
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
            className={cn(
              "inline-flex h-7 min-w-7 items-center justify-center gap-x-1.5 rounded-md px-2 text-xs font-semibold text-white/75 transition hover:bg-white/15 hover:text-white",
              view.active && "bg-white text-neutral-800 shadow-sm hover:bg-white hover:text-neutral-900",
            )}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden sm:inline">{view.label}</span>
          </Link>
        );
      })}
    </nav>
  );
};
