import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { ActivityItem } from "@/components/activity-item";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity } from "lucide-react";

export const ActivityList = async () => {
  const { orgId } = await auth();

  if (!orgId) {
    redirect("/select-org");
  }

  const auditLogs = await db.auditLog.findMany({
    where: {
      orgId,
    },
    orderBy: {
      createdAt: "desc"
    }
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

  return (
    <ol className="space-y-4 mt-4">
      {auditLogs.map((log) => (
        <ActivityItem key={log.id} data={log} />
      ))}
    </ol>
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