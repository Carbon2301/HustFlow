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
    <div className="flex items-start gap-x-3 w-full">
      <div className="w-8 h-8 rounded-lg bg-neutral-100 flex items-center justify-center flex-shrink-0 mt-0.5">
        <ActivityIcon className="h-4 w-4 text-neutral-500" />
      </div>
      <div className="w-full min-w-0">
        <p className="font-semibold text-sm text-neutral-700 mb-3">
          Activity
        </p>
        {items.length === 0 ? (
          <p className="text-sm text-neutral-400 italic">No activity yet.</p>
        ) : (
          <ol className="space-y-3">
            {items.map((item) => (
              <ActivityItem
                key={item.id}
                data={item}
              />
            ))}
          </ol>
        )}
      </div>
    </div>
  );
};

Activity.Skeleton = function ActivitySkeleton() {
  return (
    <div className="flex items-start gap-x-3 w-full">
      <Skeleton className="h-8 w-8 rounded-lg bg-neutral-100" />
      <div className="w-full space-y-2">
        <Skeleton className="w-20 h-4 rounded bg-neutral-100" />
        <div className="space-y-3">
          <Skeleton className="w-full h-8 rounded-lg bg-neutral-100" />
          <Skeleton className="w-3/4 h-8 rounded-lg bg-neutral-100" />
        </div>
      </div>
    </div>
  );
};