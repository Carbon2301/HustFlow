import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation";
import Link from "next/link";
import { Activity, ChevronLeft, ChevronRight } from "lucide-react";

import { db } from "@/lib/db";
import { ActivityItem } from "@/components/activity-item";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface ActivityListProps {
  page: number;
}

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
    totalPages
  ];
};

export const ActivityList = async ({ page }: ActivityListProps) => {
  const { orgId } = await auth();

  if (!orgId) {
    redirect("/select-org");
  }

  const itemsPerPage = 50;

  const totalLogs = await db.auditLog.count({
    where: {
      orgId,
    },
  });

  const totalPages = Math.ceil(totalLogs / itemsPerPage);

  const auditLogs = await db.auditLog.findMany({
    where: {
      orgId,
    },
    orderBy: {
      createdAt: "desc"
    },
    skip: (page - 1) * itemsPerPage,
    take: itemsPerPage,
  });

  if (auditLogs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] border border-dashed border-neutral-200 rounded-2xl p-8 text-center bg-neutral-50/50 mt-4">
        <div className="w-12 h-12 bg-neutral-100 rounded-2xl flex items-center justify-center mb-4">
          <Activity className="h-6 w-6 text-neutral-400" />
        </div>
        <h3 className="font-semibold text-neutral-800 text-base">Không tìm thấy hoạt động nào</h3>
        <p className="text-sm text-neutral-400 max-w-sm mt-1">
          Thực hiện một số thao tác trên bảng của bạn (như tạo danh sách hoặc thẻ) để bắt đầu xem nhật ký hoạt động.
        </p>
      </div>
    );
  }

  const pages = getPages(page, totalPages);

  return (
    <div className="flex flex-col gap-y-6">
      <ol className="space-y-4 mt-4">
        {auditLogs.map((log) => (
          <ActivityItem key={log.id} data={log} />
        ))}
      </ol>
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-x-2 pt-6 pb-8">
          <Link
            href={`?page=${Math.max(1, page - 1)}`}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 transition-all text-neutral-600 shadow-sm",
              page <= 1 && "pointer-events-none opacity-40"
            )}
            aria-disabled={page <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          {pages.map((p, index) => {
            if (p === "...") {
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
                href={`?page=${p}`}
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-lg border text-sm font-medium transition-all shadow-sm",
                  p === page
                    ? "border-violet-600 bg-violet-600 text-white shadow-violet-100"
                    : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"
                )}
              >
                {p}
              </Link>
            );
          })}
          <Link
            href={`?page=${Math.min(totalPages, page + 1)}`}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 transition-all text-neutral-600 shadow-sm",
              page >= totalPages && "pointer-events-none opacity-40"
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