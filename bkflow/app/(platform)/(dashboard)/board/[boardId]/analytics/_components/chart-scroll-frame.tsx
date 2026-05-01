"use client";

import type { ReactNode } from "react";

export const ChartScrollFrame = ({
  children,
  height,
}: {
  children: ReactNode;
  height: number;
}) => (
  <div className="max-h-[360px] overflow-y-auto pr-1 styled-scrollbar">
    <div className="min-w-0" style={{ height }}>
      {children}
    </div>
  </div>
);
