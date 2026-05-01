"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export const ChartPanel = ({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) => (
  <section className={cn("rounded-2xl border border-neutral-200/60 bg-white p-5 shadow-xs transition-shadow duration-300 hover:shadow-sm flex flex-col", className)}>
    <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
      <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
      {action}
    </div>
    <div className="pt-4 flex-1">{children}</div>
  </section>
);
