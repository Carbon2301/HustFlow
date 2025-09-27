"use client";

import { AuditLog } from "@prisma/client";
import { ActivityIcon } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { ActivityItem } from "@/components/activity-item";

interface ActivityProps {
  items: AuditLog[];
};

export const Activity = ({
  items,
}: ActivityProps) => {
  return (
    <div className="w-full">
      <div className="flex items-center gap-x-3 mb-4">
        <ActivityIcon className="h-5 w-5 text-neutral-500 flex-shrink-0" />
        <p className="font-semibold text-base text-neutral-800">
          Nhật ký hoạt động
        </p>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-neutral-400 italic pl-0">Chưa có hoạt động nào.</p>
      ) : (
        <div className="max-h-[250px] overflow-y-auto pr-2 styled-scrollbar">
          <ol className="space-y-3.5 pl-0">
            {items.map((item) => (
              <ActivityItem
                key={item.id}
                data={item}
              />
            ))}
          </ol>
        </div>
      )}
    </div>
  );
};

Activity.Skeleton = function ActivitySkeleton() {
  return (
    <div className="w-full space-y-4">
      <div className="flex items-center gap-x-3">
        <Skeleton className="h-5 w-5 rounded bg-neutral-100" />
        <Skeleton className="w-32 h-5 rounded bg-neutral-100" />
      </div>
      <div className="space-y-3 pl-0">
        <Skeleton className="w-full h-10 rounded-xl bg-neutral-100" />
        <Skeleton className="w-3/4 h-10 rounded-xl bg-neutral-100" />
        <Skeleton className="w-full h-10 rounded-xl bg-neutral-100" />
      </div>
    </div>
  );
};

