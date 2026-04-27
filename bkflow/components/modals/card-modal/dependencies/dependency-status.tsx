"use client";

import { AlertTriangle, Archive, CheckCircle2 } from "lucide-react";

import type { DependencyListItem } from "./dependency-utils";

export const DependencyStatus = ({
  relatedCard,
}: Pick<DependencyListItem, "relatedCard">) => {
  if (relatedCard.archivedAt) {
    return (
      <span className="inline-flex items-center gap-x-1 rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700">
        <Archive className="h-3 w-3" />
        Đã lưu trữ
      </span>
    );
  }

  if (relatedCard.isCompleted) {
    return (
      <span className="inline-flex items-center gap-x-1 rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700">
        <CheckCircle2 className="h-3 w-3" />
        Đã xong
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-x-1 rounded-md border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[11px] font-semibold text-rose-700">
      <AlertTriangle className="h-3 w-3" />
      Chưa xong
    </span>
  );
};
