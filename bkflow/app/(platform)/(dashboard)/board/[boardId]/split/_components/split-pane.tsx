"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

interface SplitPaneProps {
  calendarNode: React.ReactNode;
  boardNode: React.ReactNode;
}

export const SplitPane = ({ calendarNode, boardNode }: SplitPaneProps) => {
  const [leftPercent, setLeftPercent] = useState(55); // Default to 55% for calendar
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const startResizing = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
  }, []);

  const resize = useCallback(
    (e: PointerEvent) => {
      if (!isResizing || !containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const relativeX = e.clientX - containerRect.left;
      const percent = (relativeX / containerRect.width) * 100;

      // Limit resize range between 25% and 75%
      const newPercent = Math.max(25, Math.min(75, percent));
      setLeftPercent(newPercent);
    },
    [isResizing]
  );

  useEffect(() => {
    if (isResizing) {
      window.addEventListener("pointermove", resize);
      window.addEventListener("pointerup", stopResizing);
      // Change body cursor globally to prevent cursor flickering during drag
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    } else {
      window.removeEventListener("pointermove", resize);
      window.removeEventListener("pointerup", stopResizing);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }

    return () => {
      window.removeEventListener("pointermove", resize);
      window.removeEventListener("pointerup", stopResizing);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, resize, stopResizing]);

  const style = {
    "--calendar-width": `${leftPercent}%`,
    "--board-width": `${100 - leftPercent}%`,
  } as React.CSSProperties;

  return (
    <div
      ref={containerRef}
      style={style}
      className="flex h-full min-h-0 w-full flex-col gap-3 overflow-y-auto p-3 md:p-4 xl:flex-row xl:overflow-hidden xl:gap-0"
    >
      {/* Calendar Pane */}
      <section
        className={cn(
          "flex min-h-[620px] min-w-0 flex-col overflow-hidden xl:min-h-0 xl:h-full w-full xl:w-[var(--calendar-width)]",
          isResizing && "pointer-events-none select-none" // Disable mouse interactions while dragging
        )}
      >
        <div className="min-h-0 flex-1 overflow-hidden xl:pr-3">
          {calendarNode}
        </div>
      </section>

      {/* Resizable Divider (Visible and active only on desktop screen size) */}
      <div
        onPointerDown={startResizing}
        className={cn(
          "hidden xl:flex relative w-4 items-center justify-center cursor-col-resize select-none shrink-0 group z-50 h-full transition-colors duration-200",
          isResizing ? "bg-violet-500/10" : "hover:bg-violet-500/5"
        )}
      >
        {/* The visual dividing border line */}
        <div
          className={cn(
            "w-[2px] h-[95%] bg-white/20 transition-all duration-200 rounded-full",
            isResizing ? "bg-violet-500 w-[3px]" : "group-hover:bg-violet-400 group-hover:w-[3px]"
          )}
        />
        {/* Small grab handle in the center */}
        <div
          className={cn(
            "absolute flex flex-col gap-1 items-center justify-center w-5 h-9 rounded-md border border-neutral-200/30 bg-neutral-800/80 backdrop-blur shadow-md transition-all duration-200",
            isResizing ? "border-violet-500 bg-violet-600 scale-105" : "group-hover:border-violet-400 group-hover:bg-neutral-700/80"
          )}
        >
          {/* Grab icons: three dots */}
          <div className="w-1 h-1 rounded-full bg-white/60" />
          <div className="w-1 h-1 rounded-full bg-white/60" />
          <div className="w-1 h-1 rounded-full bg-white/60" />
        </div>
      </div>

      {/* Board Pane */}
      <section
        className={cn(
          "flex min-h-[520px] min-w-0 flex-col overflow-hidden xl:min-h-0 xl:h-full w-full xl:w-[var(--board-width)]",
          isResizing && "pointer-events-none select-none"
        )}
      >
        <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden rounded-lg bg-white/15 p-3 xl:pl-3">
          {boardNode}
        </div>
      </section>
    </div>
  );
};
