"use client";

import { useCallback, useEffect, useState } from "react";
import {
  addDays,
  addMonths,
  addWeeks,
  subDays,
  subMonths,
  subWeeks,
} from "date-fns";

import type { BoardCalendarList, ViewMode } from "../_types";

type UseCalendarStateOptions = {
  defaultUnscheduledCollapsed: boolean;
  initialNowIso: string;
  lists: BoardCalendarList[];
};

export const useCalendarState = ({
  defaultUnscheduledCollapsed,
  initialNowIso,
  lists,
}: UseCalendarStateOptions) => {
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [anchorDate, setAnchorDate] = useState(() => new Date(initialNowIso));
  const [currentTime, setCurrentTime] = useState(() => new Date(initialNowIso));
  const [expandedDayKey, setExpandedDayKey] = useState<string | null>(null);
  const [openDayOverflowGroupId, setOpenDayOverflowGroupId] = useState<string | null>(null);
  const [createDialogDay, setCreateDialogDay] = useState<Date | null>(null);
  const [createTitle, setCreateTitle] = useState("");
  const [createStartValue, setCreateStartValue] = useState("");
  const [createDueValue, setCreateDueValue] = useState("");
  const [createListId, setCreateListId] = useState(() => lists[0]?.id ?? "");
  const [isUnscheduledCollapsed, setIsUnscheduledCollapsed] = useState(
    defaultUnscheduledCollapsed,
  );

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setCurrentTime(new Date());
    }, 60_000);

    return () => window.clearInterval(intervalId);
  }, []);

  const goToPrevious = useCallback(() => {
    setExpandedDayKey(null);
    setAnchorDate((value) => {
      if (viewMode === "month") {
        return subMonths(value, 1);
      }

      if (viewMode === "week") {
        return subWeeks(value, 1);
      }

      return subDays(value, 1);
    });
  }, [viewMode]);

  const goToNext = useCallback(() => {
    setExpandedDayKey(null);
    setAnchorDate((value) => {
      if (viewMode === "month") {
        return addMonths(value, 1);
      }

      if (viewMode === "week") {
        return addWeeks(value, 1);
      }

      return addDays(value, 1);
    });
  }, [viewMode]);

  const goToToday = useCallback(() => {
    setExpandedDayKey(null);
    setAnchorDate(new Date());
  }, []);

  const changeViewMode = useCallback((mode: ViewMode) => {
    setExpandedDayKey(null);
    setViewMode(mode);
  }, []);

  const resetCreateDialog = useCallback(() => {
    setCreateDialogDay(null);
    setCreateTitle("");
    setCreateStartValue("");
    setCreateDueValue("");
  }, []);

  return {
    viewMode,
    setViewMode,
    anchorDate,
    setAnchorDate,
    currentTime,
    setCurrentTime,
    expandedDayKey,
    setExpandedDayKey,
    openDayOverflowGroupId,
    setOpenDayOverflowGroupId,
    createDialogDay,
    setCreateDialogDay,
    createTitle,
    setCreateTitle,
    createStartValue,
    setCreateStartValue,
    createDueValue,
    setCreateDueValue,
    createListId,
    setCreateListId,
    isUnscheduledCollapsed,
    setIsUnscheduledCollapsed,
    goToPrevious,
    goToNext,
    goToToday,
    changeViewMode,
    resetCreateDialog,
  };
};
