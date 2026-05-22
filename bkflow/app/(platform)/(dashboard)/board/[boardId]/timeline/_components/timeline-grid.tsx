"use client";

import {
  type PointerEvent,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { isToday } from "date-fns";

import { cn } from "@/lib/utils";

import type {
  DependencyLine,
  ScheduledCard,
  TimelineInteraction,
  TimelineInteractionMode,
  TimelineUnit,
  TimelineZoom,
} from "../_types";
import {
  COLUMN_WIDTH_BY_ZOOM,
  HEADER_HEIGHT,
  MIN_GRID_WIDTH,
  ROW_HEIGHT,
} from "../_lib/layout-utils";
import {
  getDependencyLineModels,
  type TimelineDependencyRect,
} from "../_lib/dependency-layout";
import { DependencyLines } from "./dependency-lines";
import { TimelineRow } from "./timeline-row";

type TimelineGridProps = {
  rows: ScheduledCard[];
  units: TimelineUnit[];
  zoom: TimelineZoom;
  onOpenCard: (cardId: string) => void;
  onBarPointerDown: (
    event: PointerEvent<HTMLElement>,
    row: ScheduledCard,
    mode: TimelineInteractionMode,
    columnWidth: number,
  ) => void;
  canEdit: boolean;
  updatingCardId: string | null;
  activeInteraction: TimelineInteraction | null;
  scrollContainerRef: RefObject<HTMLDivElement | null>;
  isExporting?: boolean;
};

export const TimelineGrid = ({
  rows,
  units,
  zoom,
  onOpenCard,
  onBarPointerDown,
  canEdit,
  updatingCardId,
  activeInteraction,
  scrollContainerRef,
  isExporting = false,
}: TimelineGridProps) => {
  const columnWidth = COLUMN_WIDTH_BY_ZOOM[zoom];
  const gridWidth = Math.max(units.length * columnWidth, MIN_GRID_WIDTH);
  const gridHeight = rows.length * ROW_HEIGHT;
  const gridContentRef = useRef<HTMLDivElement | null>(null);
  const cardNodeRefs = useRef(new Map<string, HTMLButtonElement>());
  const [dependencyLines, setDependencyLines] = useState<DependencyLine[]>([]);
  const rowsByCardId = useMemo(() => (
    new Map(rows.map((row) => [row.card.id, row]))
  ), [rows]);
  const setCardNodeRef = useCallback((
    cardId: string,
    node: HTMLButtonElement | null,
  ) => {
    if (node) {
      cardNodeRefs.current.set(cardId, node);
      return;
    }

    cardNodeRefs.current.delete(cardId);
  }, []);
  const measureDependencyLines = useCallback(() => {
    const gridContent = gridContentRef.current;

    if (!gridContent) {
      setDependencyLines([]);
      return;
    }

    const contentDomRect = gridContent.getBoundingClientRect();
    const rectsByCardId = new Map<string, TimelineDependencyRect>();

    cardNodeRefs.current.forEach((node, cardId) => {
      const rect = node.getBoundingClientRect();
      rectsByCardId.set(cardId, {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        height: rect.height,
      });
    });

    setDependencyLines(getDependencyLineModels({
      rows,
      rowsByCardId,
      rectsByCardId,
      contentRect: {
        left: contentDomRect.left,
        top: contentDomRect.top,
      },
    }));
  }, [rows, rowsByCardId]);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(measureDependencyLines);

    return () => window.cancelAnimationFrame(frameId);
  }, [
    activeInteraction,
    gridHeight,
    gridWidth,
    measureDependencyLines,
    units,
    isExporting,
    updatingCardId,
    zoom,
  ]);

  useEffect(() => {
    let frameId: number | null = null;
    const scheduleMeasure = () => {
      if (frameId !== null) {
        return;
      }

      frameId = window.requestAnimationFrame(() => {
        frameId = null;
        measureDependencyLines();
      });
    };
    const resizeObserver = new ResizeObserver(scheduleMeasure);
    const gridContent = gridContentRef.current;
    const scrollContainer = scrollContainerRef.current;

    if (gridContent) {
      resizeObserver.observe(gridContent);
    }

    if (scrollContainer) {
      resizeObserver.observe(scrollContainer);
      scrollContainer.addEventListener("scroll", scheduleMeasure, { passive: true });
    }

    scheduleMeasure();

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }

      resizeObserver.disconnect();
      scrollContainer?.removeEventListener("scroll", scheduleMeasure);
    };
  }, [measureDependencyLines, scrollContainerRef]);

  return (
    <div className="min-w-0 flex-1">
      <div
        className="sticky top-0 z-10 grid border-b border-neutral-200 bg-white"
        style={{
          height: HEADER_HEIGHT,
          width: gridWidth,
          gridTemplateColumns: `repeat(${units.length}, ${columnWidth}px)`,
        }}
      >
        {units.map((unit) => (
          <div
            key={unit.key}
            className={cn(
              "flex items-center border-r border-neutral-200 px-2 text-xs font-semibold text-neutral-500",
              isToday(unit.start) && "bg-blue-50 text-blue-700",
            )}
          >
            {unit.label}
          </div>
        ))}
      </div>
      <div
        ref={gridContentRef}
        className="relative"
        style={{ width: gridWidth, minHeight: gridHeight }}
      >
        <DependencyLines
          lines={dependencyLines}
          width={gridWidth}
          height={gridHeight}
        />
        {rows.map((row) => (
          <TimelineRow
            key={row.card.id}
            row={row}
            units={units}
            columnWidth={columnWidth}
            onOpenCard={onOpenCard}
            onBarPointerDown={onBarPointerDown}
            canEdit={canEdit}
            updatingCardId={updatingCardId}
            activeInteraction={activeInteraction}
            setCardNodeRef={setCardNodeRef}
            isExporting={isExporting}
          />
        ))}
      </div>
    </div>
  );
};
