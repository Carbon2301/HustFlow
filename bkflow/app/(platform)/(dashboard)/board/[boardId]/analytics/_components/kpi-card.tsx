"use client";

import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export const KpiCard = ({
  label,
  value,
  tone,
  icon: Icon,
  gradient,
}: {
  label: string;
  value: string | number;
  tone: string;
  icon: LucideIcon;
  gradient: string;
}) => (
  <div className="relative overflow-hidden rounded-2xl border border-neutral-200/60 bg-white p-5 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:shadow-md group">
    {/* Decorative background glow */}
    <div className={cn("absolute -right-6 -bottom-6 h-24 w-24 rounded-full opacity-10 blur-xl transition-all duration-300 group-hover:scale-150", gradient)} />

    <div className="flex items-center justify-between">
      <div className="space-y-1.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{label}</span>
        <h3 className="text-2xl font-bold leading-none text-neutral-900">{value}</h3>
      </div>
      <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl shadow-xs transition-transform duration-300 group-hover:scale-110", tone)}>
        <Icon className="h-5 w-5" />
      </div>
    </div>
  </div>
);
