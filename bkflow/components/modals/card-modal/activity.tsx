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
    <div className="flex items-start gap-x-4 w-full">
      <div className="w-10 h-10 rounded-xl bg-neutral-100 flex items-center justify-center flex-shrink-0 mt-0.5">
        <ActivityIcon className="h-5 w-5 text-neutral-500" />
      </div>
      <div className="w-full min-w-0">
        <p className="font-semibold text-base text-neutral-800 mb-4">
          Nhật ký hoạt động
        </p>
        {items.length === 0 ? (
          <p className="text-sm text-neutral-400 italic">Chưa có hoạt động nào.</p>
        ) : (
          <div className="max-h-[350px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-neutral-200 scrollbar-track-transparent">
            <ol className="space-y-3.5">
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
    </div>
  );
};

Activity.Skeleton = function ActivitySkeleton() {
  return (
    <div className="flex items-start gap-x-4 w-full">
      <Skeleton className="h-10 w-10 rounded-xl bg-neutral-100" />
      <div className="w-full space-y-3">
        <Skeleton className="w-20 h-5 rounded bg-neutral-100" />
        <div className="space-y-3">
          <Skeleton className="w-full h-10 rounded-xl bg-neutral-100" />
          <Skeleton className="w-3/4 h-10 rounded-xl bg-neutral-100" />
        </div>
      </div>
    </div>
  );
};