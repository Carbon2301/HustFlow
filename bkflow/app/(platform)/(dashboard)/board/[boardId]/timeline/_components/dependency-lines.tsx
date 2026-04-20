"use client";

import { cn } from "@/lib/utils";

import type { DependencyLine } from "../_types";

type DependencyLinesProps = {
  lines: DependencyLine[];
  width: number;
  height: number;
};

export const DependencyLines = ({
  lines,
  width,
  height,
}: DependencyLinesProps) => {
  if (lines.length === 0) {
    return null;
  }

  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-10 overflow-visible"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
    >
      <defs>
        <marker
          id="timeline-dependency-arrow"
          viewBox="0 0 8 8"
          refX="7"
          refY="4"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 8 4 L 0 8 z" className="fill-sky-400" />
        </marker>
        <marker
          id="timeline-dependency-conflict-arrow"
          viewBox="0 0 8 8"
          refX="7"
          refY="4"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 8 4 L 0 8 z" className="fill-rose-500" />
        </marker>
      </defs>
      {lines.map((line) => {
        const controlOffset = Math.max(40, Math.abs(line.x2 - line.x1) / 2);
        const path = [
          `M ${line.x1} ${line.y1}`,
          `C ${line.x1 + controlOffset} ${line.y1}`,
          `${line.x2 - controlOffset} ${line.y2}`,
          `${line.x2} ${line.y2}`,
        ].join(" ");

        return (
          <g key={line.key}>
            <path
              d={path}
              fill="none"
              strokeWidth={line.hasConflict ? 2.25 : 1.75}
              strokeLinecap="round"
              strokeLinejoin="round"
              markerEnd={`url(#${line.hasConflict
                ? "timeline-dependency-conflict-arrow"
                : "timeline-dependency-arrow"})`}
              className={cn(
                line.hasConflict
                  ? "stroke-rose-500"
                  : "stroke-sky-400/70",
              )}
            />
            {line.hasConflict && (
              <g transform={`translate(${line.x2 - 18} ${line.y2 - 18})`}>
                <circle r="8" cx="8" cy="8" className="fill-rose-50 stroke-rose-500" />
                <path
                  d="M8 4.5v4.25M8 11.25h.01"
                  fill="none"
                  strokeLinecap="round"
                  strokeWidth="1.7"
                  className="stroke-rose-600"
                />
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
};
