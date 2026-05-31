import type { CSSProperties } from "react";

import type { BoardCardCalendarDragPayload } from "@/lib/calendar/calendar-dnd";
import type { BoardCalendarCardItem, BoardCalendarItem } from "@/types";

export interface BoardCalendarViewProps {
  boardId: string;
  lists: BoardCalendarList[];
  currentUserId: string;
  currentBoardMemberId: string;
  initialNowIso: string;
  defaultUnscheduledCollapsed?: boolean;
  variant?: "default" | "split";
}

export type BoardCalendarList = {
  id: string;
  title: string;
  order: number;
};

export type ViewMode = "month" | "week" | "day";
export type CalendarOccurrenceKind = "single" | "start" | "due" | "range";

export type CalendarOccurrence = {
  id: string;
  kind: CalendarOccurrenceKind;
  date: Date;
  item: BoardCalendarItem;
};

export type CalendarRange = {
  id: string;
  item: BoardCalendarCardItem;
  startDate: Date;
  endDate: Date;
  startKey: string;
  endKey: string;
};

export type CalendarRangeSegment = {
  id: string;
  range: CalendarRange;
  weekIndex: number;
  startIndex: number;
  endIndex: number;
  lane: number;
  isRangeStart: boolean;
  isRangeEnd: boolean;
};

export type BoardCalendarRealtimePayload = {
  eventId: string;
  boardId: string;
  actorUserId: string;
};

export type BoardCalendarAccessPayload = BoardCalendarRealtimePayload & {
  orgId: string;
  targetUserId?: string;
};

export type CalendarOccurrenceDragPayload = {
  kind: "calendar-occurrence";
  occurrenceId: string;
};

export type UnscheduledCardDragPayload = {
  kind: "unscheduled-card";
  cardId: string;
  title: string;
  isCompleted: boolean;
};

export type DayViewCardBlockDragPayload = {
  kind: "day-view-card-block";
  blockId: string;
};

export type CalendarDragPayload =
  | CalendarOccurrenceDragPayload
  | UnscheduledCardDragPayload
  | DayViewCardBlockDragPayload
  | BoardCardCalendarDragPayload;

export type CalendarResizeEdge = "start" | "end";

export type CalendarResizeState = {
  edge: CalendarResizeEdge;
  pointerId: number;
  range: CalendarRange;
  targetDayKey: string;
};

export type DayViewResizeState = {
  edge: CalendarResizeEdge;
  pointerId: number;
  block: PositionedDayViewBlock;
  targetMinute: number;
};

export type DayViewCreateSelectionState = {
  pointerId: number;
  anchorMinute: number;
  currentMinute: number;
};

export type CalendarMarkerListStyle = CSSProperties & {
  "--pt-desktop"?: string;
};

export type DayViewBlock = {
  id: string;
  item: BoardCalendarItem;
  startsAt: Date;
  endsAt: Date;
  startMinute: number;
  endMinute: number;
  top: number;
  height: number;
};

export type PositionedDayViewBlock = DayViewBlock & {
  lane: number;
  laneCount: number;
  isHiddenByLaneLimit: boolean;
  leftPercent: number;
  widthPercent: number;
};

export type DayViewOverflowGroup = {
  id: string;
  startMinute: number;
  endMinute: number;
  top: number;
  height: number;
  hiddenBlocks: PositionedDayViewBlock[];
};

export type DayViewBlockLayout = {
  visibleBlocks: PositionedDayViewBlock[];
  overflowGroups: DayViewOverflowGroup[];
};

export type DayViewBlockStyle = CSSProperties & {
  "--day-block-left"?: string;
  "--day-block-width"?: string;
};
