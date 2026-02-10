import { auth } from "@clerk/nextjs/server";
import { AUDIT_EVENT_TYPE, Prisma } from "@prisma/client";
import { format, isToday, isYesterday } from "date-fns";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Activity, ChevronLeft, ChevronRight } from "lucide-react";

import { ActivityItem } from "@/components/activity-item";
import { Skeleton } from "@/components/ui/skeleton";
import { db } from "@/lib/db";
import { cn } from "@/lib/utils";

import { ActivityFilters } from "./activity-filters";

interface ActivityListProps {
  page: number;
  boardId?: string;
  eventType?: string;
  userId?: string;
  range?: string;
  from?: string;
  to?: string;
  q?: string;
  searchParams?: Record<string, string | undefined>;
}

const validRanges = new Set(["today", "7d", "30d", "all", "custom"]);

const getPages = (currentPage: number, totalPages: number) => {
  if (totalPages <= 8) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, "...", totalPages - 2, totalPages - 1, totalPages];
  }

  if (currentPage >= totalPages - 3) {
    return [1, 2, 3, "...", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }

  return [
    1,
    "...",
    currentPage - 1,
    currentPage,
    currentPage + 1,
    "...",
    totalPages,
  ];
};

const buildPageHref = (
  searchParams: Record<string, string | undefined> | undefined,
  page: number,
  normalizedParams: Record<string, string | undefined>,
) => {
  const params = new URLSearchParams();

  Object.entries(searchParams ?? {}).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    }
  });

  Object.entries(normalizedParams).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
  });

  params.set("page", String(page));

  return `?${params.toString()}`;
};

const parseEventTypes = (value?: string): AUDIT_EVENT_TYPE[] => {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((val) => val.trim())
    .filter((val) => Object.values(AUDIT_EVENT_TYPE).includes(val as AUDIT_EVENT_TYPE)) as AUDIT_EVENT_TYPE[];
};

const parseDateParam = (value?: string) => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getCreatedAtFilter = (
  range: string,
  from?: string,
  to?: string,
): Prisma.DateTimeFilter | undefined => {
  const now = new Date();

  if (range === "all") {
    return undefined;
  }

  if (range === "today") {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return {
      gte: start,
      lte: now,
    };
  }

  if (range === "7d" || range === "30d") {
    const days = range === "7d" ? 7 : 30;
    const start = new Date(now);
    start.setDate(start.getDate() - days);

    return {
      gte: start,
      lte: now,
    };
  }

  if (range === "custom") {
    const fromDate = parseDateParam(from);
    const toDate = parseDateParam(to);

    if (!fromDate && !toDate) {
      return undefined;
    }

    if (toDate) {
      toDate.setHours(23, 59, 59, 999);
    }

    return {
      ...(fromDate ? { gte: fromDate } : {}),
      ...(toDate ? { lte: toDate } : {}),
    };
  }

  return undefined;
};

const getGroupLabel = (date: Date) => {
  if (isToday(date)) {
    return "Hôm nay";
  }

  if (isYesterday(date)) {
    return "Hôm qua";
  }

  return format(date, "dd/MM/yyyy");
};

const groupAuditLogsByDay = <T extends { createdAt: Date }>(logs: T[]) => {
  const groups = new Map<string, { key: string; label: string; items: T[] }>();

  logs.forEach((log) => {
    const date = new Date(log.createdAt);
    const key = format(date, "yyyy-MM-dd");
    const existingGroup = groups.get(key);

    if (existingGroup) {
      existingGroup.items.push(log);
      return;
    }

    groups.set(key, {
      key,
      label: getGroupLabel(date),
      items: [log],
    });
  });

  return Array.from(groups.values());
};

export const ActivityList = async ({
  page,
  boardId,
  eventType,
  userId,
  range,
  from,
  to,
  q,
  searchParams,
}: ActivityListProps) => {
  const { orgId, userId: currentUserId } = await auth();

  if (!orgId || !currentUserId) {
    redirect("/select-org");
  }

  const itemsPerPage = 50;
  const selectedRange = range && validRanges.has(range) ? range : "30d";
  const selectedEventTypes = parseEventTypes(eventType);
  const boards = await db.board.findMany({
    where: {
      orgId,
      members: {
        some: {
          userId: currentUserId,
        },
      },
    },
    select: {
      id: true,
      title: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
  const boardIds = boardId ? boardId.split(",") : [];
  const validBoardIds = boards
    .map((b) => b.id)
    .filter((id) => boardIds.includes(id));

  const actorBaseWhere: Prisma.AuditLogWhereInput = {
    orgId,
    boardId: {
      in: validBoardIds.length > 0 ? validBoardIds : boards.map((b) => b.id),
    },
  };
  const actors = await db.auditLog.findMany({
    where: actorBaseWhere,
    distinct: ["userId"],
    select: {
      userId: true,
      userName: true,
      userImage: true,
    },
    orderBy: {
      userName: "asc",
    },
  });
  const userIds = userId ? userId.split(",") : [];
  const validUserIds = actors
    .map((actor) => actor.userId)
    .filter((id) => userIds.includes(id));

  const createdAt = getCreatedAtFilter(selectedRange, from, to);
  const search = q?.trim();
  const normalizedParams = {
    boardId: validBoardIds.length > 0 ? validBoardIds.join(",") : undefined,
    eventType: selectedEventTypes.length > 0 ? selectedEventTypes.join(",") : undefined,
    userId: validUserIds.length > 0 ? validUserIds.join(",") : undefined,
    range: selectedRange === "30d" && !range ? undefined : selectedRange,
    from: selectedRange === "custom" ? from : undefined,
    to: selectedRange === "custom" ? to : undefined,
    q: search || undefined,
  };
  const where: Prisma.AuditLogWhereInput = {
    orgId,
    boardId: {
      in: validBoardIds.length > 0 ? validBoardIds : boards.map((b) => b.id),
    },
    ...(selectedEventTypes.length > 0 ? { eventType: { in: selectedEventTypes } } : {}),
    ...(validUserIds.length > 0 ? { userId: { in: validUserIds } } : {}),
    ...(createdAt ? { createdAt } : {}),
    ...(search ? {
      AND: [
        {
          OR: [
            {
              entityTitle: {
                contains: search,
              },
            },
            {
              userName: {
                contains: search,
              },
            },
          ],
        },
      ],
    } : {}),
  };

  const totalLogs = await db.auditLog.count({
    where,
  });

  const totalPages = Math.ceil(totalLogs / itemsPerPage);

  const auditLogs = await db.auditLog.findMany({
    where,
    orderBy: {
      createdAt: "desc",
    },
    skip: (page - 1) * itemsPerPage,
    take: itemsPerPage,
  });
  const cardIds = Array.from(
    new Set(
      auditLogs
        .map((log) => log.cardId || (log.entityType === "CARD" ? log.entityId : null))
        .filter(Boolean)
    )
  ) as string[];
  const existingCards = cardIds.length > 0
    ? await db.card.findMany({
        where: {
          id: {
            in: cardIds,
          },
          archivedAt: null,
          list: {
            archivedAt: null,
            board: {
              orgId,
            },
          },
        },
        select: {
          id: true,
          title: true,
        },
      })
    : [];
  const cardMap = new Map(existingCards.map((card) => [card.id, card.title]));
  const boardMap = new Map(boards.map((board) => [board.id, board.title]));

  const boardMembers = await db.boardMember.findMany({
    where: {
      board: {
        orgId,
      },
    },
    select: {
      userName: true,
    },
  });
  const memberNames = Array.from(
    new Set([
      ...actors.map((actor) => actor.userName),
      ...boardMembers.map((member) => member.userName),
    ])
  ).filter(Boolean);

  const lists = await db.list.findMany({
    where: {
      archivedAt: null,
      board: {
        orgId,
      },
    },
    select: {
      id: true,
    },
  });
  const existingListIds = new Set(lists.map((list) => list.id));

  const hasExplicitFilter = Boolean(
    validBoardIds.length > 0 ||
    selectedEventTypes.length > 0 ||
    validUserIds.length > 0 ||
    range ||
    from ||
    to ||
    search,
  );
  const filters = (
    <ActivityFilters
      boards={boards}
      actors={actors}
      selectedBoardIds={validBoardIds}
      selectedEventTypes={selectedEventTypes}
      selectedUserIds={validUserIds}
      selectedRange={selectedRange}
      searchQuery={search}
    />
  );

  if (auditLogs.length === 0) {
    return (
      <div className="flex flex-col gap-y-4">
        {filters}
        <div className="flex flex-col items-center justify-center min-h-[300px] border border-dashed border-neutral-200 rounded-2xl p-8 text-center bg-neutral-50/50">
          <div className="w-12 h-12 bg-neutral-100 rounded-2xl flex items-center justify-center mb-4">
            <Activity className="h-6 w-6 text-neutral-400" />
          </div>
          <h3 className="font-semibold text-neutral-800 text-base">Không tìm thấy hoạt động nào</h3>
          <p className="text-sm text-neutral-400 max-w-sm mt-1">
            {search
              ? `Không tìm thấy hoạt động nào cho "${search}".`
              : hasExplicitFilter
              ? "Không có hoạt động phù hợp với bộ lọc hiện tại."
              : "Chưa có hoạt động nào trong 30 ngày qua."}
          </p>
        </div>
      </div>
    );
  }

  const pages = getPages(page, totalPages);
  const groupedAuditLogs = groupAuditLogsByDay(auditLogs);

  return (
    <div className="flex flex-col gap-y-6">
      {filters}
      <div className="mt-2 flex flex-col gap-y-7">
        {groupedAuditLogs.map((group) => (
          <section key={group.key} className="flex flex-col gap-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              {group.label}
            </h3>
            <ol className="space-y-4">
              {group.items.map((log) => {
                const resolvedCardId = log.cardId || (log.entityType === "CARD" ? log.entityId : null);
                const boardTitle = log.boardId ? boardMap.get(log.boardId) : undefined;
                const cardTitle = resolvedCardId ? cardMap.get(resolvedCardId) : undefined;
                const listExists = log.entityType === "LIST" ? existingListIds.has(log.entityId) : true;
                return (
                  <ActivityItem
                    key={log.id}
                    data={log}
                    boardTitle={boardTitle}
                    cardTitle={cardTitle}
                    listExists={listExists}
                    memberNames={memberNames}
                  />
                );
              })}
            </ol>
          </section>
        ))}
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-x-2 pt-6 pb-8">
          <Link
            href={buildPageHref(searchParams, Math.max(1, page - 1), normalizedParams)}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 transition-all text-neutral-600 shadow-sm",
              page <= 1 && "pointer-events-none opacity-40",
            )}
            aria-disabled={page <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          {pages.map((p, index) => {
            if (typeof p === "string") {
              return (
                <span
                  key={`ellipsis-${index}`}
                  className="flex h-9 w-9 items-center justify-center text-sm text-neutral-400 select-none"
                >
                  ...
                </span>
              );
            }

            return (
              <Link
                key={`page-${p}`}
                href={buildPageHref(searchParams, p, normalizedParams)}
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-lg border text-sm font-medium transition-all shadow-sm",
                  p === page
                    ? "border-violet-600 bg-violet-600 text-white shadow-violet-100"
                    : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50",
                )}
              >
                {p}
              </Link>
            );
          })}
          <Link
            href={buildPageHref(searchParams, Math.min(totalPages, page + 1), normalizedParams)}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 transition-all text-neutral-600 shadow-sm",
              page >= totalPages && "pointer-events-none opacity-40",
            )}
            aria-disabled={page >= totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      )}
    </div>
  );
};

ActivityList.Skeleton = function ActivityListSkeleton() {
  return (
    <ol className="space-y-4 mt-4">
      <Skeleton className="w-[80%] h-14 rounded-xl" />
      <Skeleton className="w-[50%] h-14 rounded-xl" />
      <Skeleton className="w-[70%] h-14 rounded-xl" />
      <Skeleton className="w-[80%] h-14 rounded-xl" />
      <Skeleton className="w-[75%] h-14 rounded-xl" />
    </ol>
  );
};
