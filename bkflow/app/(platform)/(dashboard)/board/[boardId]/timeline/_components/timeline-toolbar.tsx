"use client";

import { cn } from "@/lib/utils";

import type { TimelineZoom } from "../_types";
import { zoomLabels } from "../_lib/date-utils";

type TimelineToolbarProps = {
  zoom: TimelineZoom;
  onZoomChange: (zoom: TimelineZoom) => void;
};

export const TimelineToolbar = ({
  zoom,
  onZoomChange,
}: TimelineToolbarProps) => (
  <div className="flex items-center gap-1 rounded-lg border border-neutral-200 bg-white p-1">
    {(Object.keys(zoomLabels) as TimelineZoom[]).map((option) => (
      <button
        key={option}
        type="button"
        onClick={() => onZoomChange(option)}
        className={cn(
          "h-8 cursor-pointer rounded-md px-3 text-xs font-semibold text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-950",
          zoom === option && "bg-violet-600 text-white shadow-sm hover:bg-violet-600 hover:text-white",
        )}
      >
        {zoomLabels[option]}
      </button>
    ))}
  </div>
);
