"use client";

import { Inbox } from "lucide-react";

export const EmptyState = ({ label }: { label: string }) => (
  <div className="flex h-[280px] flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-200 bg-neutral-50/50 p-6 text-center text-sm font-medium text-neutral-400 shadow-inner">
    <Inbox className="h-8 w-8 text-neutral-300 mb-2 stroke-[1.5]" />
    {label}
  </div>
);
