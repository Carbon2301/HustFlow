"use client";

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
      {lines.map((line) => {
        const controlOffset = Math.max(40, Math.abs(line.x2 - line.x1) / 2);
        const path = [
          `M ${line.x1} ${line.y1}`,
          `C ${line.x1 + controlOffset} ${line.y1}`,
          `${line.x2 - controlOffset} ${line.y2}`,
          `${line.x2} ${line.y2}`,
        ].join(" ");
        const arrowColor = line.hasConflict ? "#f43f5e" : "#38bdf8";
        const strokeColor = line.hasConflict ? "#f43f5e" : "#38bdf8";
        const angle = 0;
        const arrowLength = 8;
        const arrowSpread = 0.55;
        const arrowPoints = [
          [line.x2, line.y2],
          [
            line.x2 - arrowLength * Math.cos(angle - arrowSpread),
            line.y2 - arrowLength * Math.sin(angle - arrowSpread),
          ],
          [
            line.x2 - arrowLength * Math.cos(angle + arrowSpread),
            line.y2 - arrowLength * Math.sin(angle + arrowSpread),
          ],
        ].map((point) => point.join(",")).join(" ");

        return (
          <g key={line.key}>
            <path
              d={path}
              fill="none"
              stroke={strokeColor}
              opacity={line.hasConflict ? 1 : 0.7}
              strokeWidth={line.hasConflict ? 2.25 : 1.75}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <polygon points={arrowPoints} fill={arrowColor} opacity={line.hasConflict ? 1 : 0.85} />
            {line.hasConflict && (
              <g transform={`translate(${line.x2 - 18} ${line.y2 - 18})`}>
                <circle r="8" cx="8" cy="8" fill="#fff1f2" stroke="#f43f5e" />
                <path
                  d="M8 4.5v4.25M8 11.25h.01"
                  fill="none"
                  strokeLinecap="round"
                  strokeWidth="1.7"
                  stroke="#e11d48"
                />
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
};
