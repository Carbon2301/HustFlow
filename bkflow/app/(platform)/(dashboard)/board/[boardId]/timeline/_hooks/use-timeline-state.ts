"use client";

import { useMemo, useState } from "react";

import type { BoardTimelineList } from "@/types";

import type {
  TimelineDateOverride,
  TimelineZoom,
} from "../_types";
import {
  applyTimelineDateOverrides,
  getTimelineDerivedData,
} from "../_lib/layout-utils";

export const useTimelineState = (lists: BoardTimelineList[], initialNowIso: string) => {
  const [zoom, setZoom] = useState<TimelineZoom>("day");
  const [dateOverrides, setDateOverrides] = useState<Record<string, TimelineDateOverride>>({});
  const [isUnscheduledPanelOpen, setIsUnscheduledPanelOpen] = useState(false);
  const [initialNow] = useState(() => new Date(initialNowIso));
  const timelineLists = useMemo(
    () => applyTimelineDateOverrides(lists, dateOverrides),
    [lists, dateOverrides],
  );
  const derived = useMemo(
    () => getTimelineDerivedData(timelineLists, zoom, initialNow),
    [timelineLists, zoom, initialNow],
  );
  const removeDateOverride = (cardId: string) => {
    setDateOverrides((current) => {
      const next = { ...current };
      delete next[cardId];
      return next;
    });
  };

  return {
    zoom,
    setZoom,
    dateOverrides,
    setDateOverrides,
    removeDateOverride,
    isUnscheduledPanelOpen,
    setIsUnscheduledPanelOpen,
    timelineLists,
    derived,
  };
};
