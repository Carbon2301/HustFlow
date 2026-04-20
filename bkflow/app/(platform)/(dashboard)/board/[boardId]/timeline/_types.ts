import type {
  BoardTimelineCard,
  BoardTimelineList,
} from "@/types";

export type TimelineZoom = "day" | "week" | "month";

export type TimelineUnit = {
  key: string;
  label: string;
  start: Date;
  end: Date;
};

export type ScheduledCard = {
  card: BoardTimelineCard;
  start: Date;
  end: Date;
  isMilestone: boolean;
  hasInvalidRange: boolean;
};

export type TimelineInteractionMode =
  | "move"
  | "resize-start"
  | "resize-end"
  | "move-milestone";

export type TimelineSingleDateField = "startDate" | "dueDate";

export type TimelineDateOverride = {
  startDate: string | null;
  dueDate: string | null;
};

export type TimelineInteraction = {
  mode: TimelineInteractionMode;
  cardId: string;
  pointerId: number;
  pointerStartX: number;
  columnWidth: number;
  originalStartDate: Date;
  originalDueDate: Date;
  originalSingleDate?: Date;
  singleDateField?: TimelineSingleDateField;
  deltaUnits: number;
  hasMoved: boolean;
};

export type DependencyLine = {
  key: string;
  sourceId: string;
  targetId: string;
  sourceTitle: string;
  targetTitle: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  hasConflict: boolean;
};

export type TimelinePlacement = {
  startIndex: number;
  endIndex: number;
  span: number;
  left: number;
  width: number;
};

export type TimelineDerivedData = {
  allCards: BoardTimelineCard[];
  scheduledCards: ScheduledCard[];
  unscheduledCards: BoardTimelineCard[];
  timelineStart: Date;
  timelineEnd: Date;
  units: TimelineUnit[];
  stats: {
    totalCards: number;
    unscheduledCards: number;
  };
};

export type TimelineListWithOverrides = BoardTimelineList;
