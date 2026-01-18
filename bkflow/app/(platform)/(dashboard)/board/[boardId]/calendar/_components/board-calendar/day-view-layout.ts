import type { BoardCalendarItem } from "@/types";

import {
  DAY_FLOATING_CARD_BLOCK_MINUTES,
  DAY_LANE_GAP_PX,
  MINUTES_IN_DAY,
} from "./constants";
import {
  formatGmt7DateTime,
  formatGmt7Time,
  getGmt7DayBoundary,
  getGmt7DayKey,
  parseCalendarDate,
} from "./date-utils";
import { isOverdue, parseDayViewItemDates } from "./item-utils";
import type {
  DayViewBlock,
  DayViewBlockLayout,
  DayViewBlockStyle,
  DayViewOverflowGroup,
  PositionedDayViewBlock,
} from "./types";

export const clampRangeToGmt7Day = (
  rangeStart: Date,
  rangeEnd: Date,
  anchorDate: Date,
) => {
  const { start: dayStart, end: dayEnd } = getGmt7DayBoundary(anchorDate);

  if (rangeEnd.getTime() <= rangeStart.getTime()) {
    return null;
  }

  if (
    rangeEnd.getTime() <= dayStart.getTime() ||
    rangeStart.getTime() >= dayEnd.getTime()
  ) {
    return null;
  }

  return {
    startsAt: new Date(Math.max(rangeStart.getTime(), dayStart.getTime())),
    endsAt: new Date(Math.min(rangeEnd.getTime(), dayEnd.getTime())),
    dayStart,
  };
};

export const getMinutesFromGmt7DayStart = (date: Date, dayStart: Date) => {
  const minutes = (date.getTime() - dayStart.getTime()) / 60_000;

  return Math.max(0, Math.min(MINUTES_IN_DAY, minutes));
};

export const getDayViewBlockPosition = (
  startsAt: Date,
  endsAt: Date,
  dayStart: Date,
) => {
  const startMinute = Math.floor(getMinutesFromGmt7DayStart(startsAt, dayStart));
  const actualEndMinute = Math.ceil(getMinutesFromGmt7DayStart(endsAt, dayStart));
  const endMinute = Math.min(
    MINUTES_IN_DAY,
    Math.max(actualEndMinute, startMinute + 15),
  );

  return {
    startMinute,
    endMinute,
    top: (startMinute / MINUTES_IN_DAY) * 100,
    height: ((endMinute - startMinute) / MINUTES_IN_DAY) * 100,
  };
};

export const getDayViewBlocks = (
  items: BoardCalendarItem[],
  anchorDate: Date,
) =>
  items.reduce<DayViewBlock[]>((acc, item) => {
    const { startDate, dueDate } = parseDayViewItemDates(item);
    const durationMinutes = item.type === "checklist-item"
      ? 15
      : DAY_FLOATING_CARD_BLOCK_MINUTES;
    let rangeStart: Date | null = null;
    let rangeEnd: Date | null = null;

    if (item.type === "checklist-item") {
      rangeStart = dueDate
        ? new Date(dueDate.getTime() - durationMinutes * 60_000)
        : null;
      rangeEnd = dueDate;
    } else if (startDate && dueDate) {
      rangeStart = startDate;
      rangeEnd = dueDate;
    } else if (dueDate) {
      rangeStart = new Date(dueDate.getTime() - durationMinutes * 60_000);
      rangeEnd = dueDate;
    } else {
      rangeStart = startDate;
      rangeEnd = startDate
        ? new Date(startDate.getTime() + durationMinutes * 60_000)
        : null;
    }

    if (!rangeStart || !rangeEnd) {
      return acc;
    }

    const clippedRange = clampRangeToGmt7Day(rangeStart, rangeEnd, anchorDate);

    if (!clippedRange) {
      return acc;
    }

    const position = getDayViewBlockPosition(
      clippedRange.startsAt,
      clippedRange.endsAt,
      clippedRange.dayStart,
    );

    if (position.endMinute <= position.startMinute) {
      return acc;
    }

    acc.push({
      id: `${item.id}:day-block:${getGmt7DayKey(anchorDate)}`,
      item,
      startsAt: clippedRange.startsAt,
      endsAt: clippedRange.endsAt,
      ...position,
    });

    return acc;
  }, [])
    .sort((left, right) => (
      left.startMinute - right.startMinute ||
      right.endMinute - left.endMinute ||
      left.item.title.localeCompare(right.item.title, "vi")
    ));

export const dayBlocksOverlap = (
  left: DayViewBlock,
  right: DayViewBlock,
) => left.startMinute < right.endMinute && left.endMinute > right.startMinute;

export const sortDayViewBlocks = (blocks: DayViewBlock[]) =>
  [...blocks].sort((left, right) => (
    left.startMinute - right.startMinute ||
    left.endMinute - right.endMinute ||
    left.id.localeCompare(right.id)
  ));

export const getPositionedClusterBlocks = (
  clusterBlocks: DayViewBlock[],
  maxLanes: number,
) => {
  const laneEnds: number[] = [];
  const assignedBlocks = clusterBlocks.map((block) => {
    const reusableLane = laneEnds.findIndex((endMinute) =>
      endMinute <= block.startMinute,
    );
    const lane = reusableLane >= 0 ? reusableLane : laneEnds.length;
    laneEnds[lane] = block.endMinute;

    return {
      block,
      lane,
    };
  });
  const laneCount = Math.max(1, laneEnds.length);
  const visibleLaneCount = Math.min(laneCount, maxLanes);

  return assignedBlocks.map<PositionedDayViewBlock>(({ block, lane }) => {
    const isHiddenByLaneLimit = lane >= maxLanes;
    const widthPercent = isHiddenByLaneLimit
      ? 0
      : 100 / visibleLaneCount;

    return {
      ...block,
      lane,
      laneCount,
      isHiddenByLaneLimit,
      leftPercent: isHiddenByLaneLimit ? 0 : lane * widthPercent,
      widthPercent,
    };
  });
};

export const getDayViewOverflowGroup = (
  clusterBlocks: PositionedDayViewBlock[],
) => {
  const hiddenBlocks = clusterBlocks.filter((block) => block.isHiddenByLaneLimit);

  if (hiddenBlocks.length === 0) {
    return null;
  }

  const startMinute = Math.min(...clusterBlocks.map((block) => block.startMinute));
  const endMinute = Math.max(...clusterBlocks.map((block) => block.endMinute));

  return {
    id: `day-overflow:${startMinute}:${endMinute}:${hiddenBlocks.map((block) => block.id).join("|")}`,
    startMinute,
    endMinute,
    top: (startMinute / MINUTES_IN_DAY) * 100,
    height: ((endMinute - startMinute) / MINUTES_IN_DAY) * 100,
    hiddenBlocks,
  } satisfies DayViewOverflowGroup;
};

export const getOverlappingDayBlockLayout = (
  blocks: DayViewBlock[],
  maxLanes: number,
): DayViewBlockLayout => {
  const sortedBlocks = sortDayViewBlocks(blocks);
  const visibleBlocks: PositionedDayViewBlock[] = [];
  const overflowGroups: DayViewOverflowGroup[] = [];
  let clusterBlocks: DayViewBlock[] = [];
  let clusterEndMinute = 0;

  const flushCluster = () => {
    if (clusterBlocks.length === 0) {
      return;
    }

    const positionedBlocks = getPositionedClusterBlocks(clusterBlocks, maxLanes);
    const overflowGroup = getDayViewOverflowGroup(positionedBlocks);

    visibleBlocks.push(
      ...positionedBlocks.filter((block) => !block.isHiddenByLaneLimit),
    );

    if (overflowGroup) {
      overflowGroups.push(overflowGroup);
    }

    clusterBlocks = [];
    clusterEndMinute = 0;
  };

  sortedBlocks.forEach((block) => {
    if (clusterBlocks.length === 0) {
      clusterBlocks = [block];
      clusterEndMinute = block.endMinute;
      return;
    }

    const overlapsCluster = block.startMinute < clusterEndMinute ||
      clusterBlocks.some((clusterBlock) => dayBlocksOverlap(block, clusterBlock));

    if (!overlapsCluster) {
      flushCluster();
      clusterBlocks = [block];
      clusterEndMinute = block.endMinute;
      return;
    }

    clusterBlocks.push(block);
    clusterEndMinute = Math.max(clusterEndMinute, block.endMinute);
  });

  flushCluster();

  return {
    visibleBlocks,
    overflowGroups,
  };
};

export const getDayViewBlockStyle = (
  block: PositionedDayViewBlock,
): DayViewBlockStyle => {
  return {
    top: `${block.top}%`,
    height: `${block.height}%`,
    "--day-block-left": `calc(${block.leftPercent}% + ${DAY_LANE_GAP_PX / 2}px)`,
    "--day-block-width": `calc(${block.widthPercent}% - ${DAY_LANE_GAP_PX}px)`,
  };
};

export const getDayViewBlockTimeLabel = (block: DayViewBlock) => {
  if (block.item.type === "checklist-item") {
    const dueDate = parseCalendarDate(block.item.dueDate);

    return dueDate ? formatGmt7Time(dueDate) : formatGmt7Time(block.endsAt);
  }

  const itemStartDate = parseCalendarDate(block.item.startDate);
  const itemDueDate = parseCalendarDate(block.item.dueDate);

  if (itemStartDate && !itemDueDate) {
    return `Bắt đầu ${formatGmt7Time(itemStartDate)}`;
  }

  if (!itemStartDate && itemDueDate) {
    return `Kết thúc ${formatGmt7Time(itemDueDate)}`;
  }

  const startTime = formatGmt7Time(block.startsAt);
  const endTime = block.endMinute >= MINUTES_IN_DAY
    ? "24:00"
    : formatGmt7Time(block.endsAt);

  return startTime === endTime ? startTime : `${startTime}-${endTime}`;
};

export const getDayViewBlockContext = (block: DayViewBlock) =>
  block.item.type === "checklist-item"
    ? block.item.checklistTitle
    : block.item.listTitle;

export const getDayViewBlockTooltip = (block: DayViewBlock) => {
  const { item } = block;
  const checklistDueDate = item.type === "checklist-item"
    ? parseCalendarDate(item.dueDate)
    : null;
  const parts = item.type === "checklist-item"
    ? [
        item.title,
        `Danh sách kiểm tra: ${item.checklistTitle}`,
        `Thẻ: ${item.cardTitle}`,
        `Kết thúc: ${formatGmt7DateTime(checklistDueDate ?? block.endsAt)} GMT+7`,
      ]
    : [
        item.title,
        `Danh sách: ${item.listTitle}`,
        item.startDate ? `Bắt đầu: ${formatGmt7DateTime(parseCalendarDate(item.startDate) ?? block.startsAt)} GMT+7` : null,
        item.dueDate ? `Kết thúc: ${formatGmt7DateTime(parseCalendarDate(item.dueDate) ?? block.endsAt)} GMT+7` : null,
      ];

  if (item.isCompleted) {
    parts.push("Trạng thái: Hoàn thành");
  }

  return parts.filter((part): part is string => !!part).join("\n");
};

export const getDayViewBlockTone = (block: DayViewBlock) => {
  if (block.item.isCompleted) {
    return "border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100";
  }

  if (isOverdue(block.item)) {
    return "border-red-200 bg-red-50 text-red-900 hover:bg-red-100";
  }

  if (block.item.type === "checklist-item") {
    return "border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100";
  }

  return "border-violet-200 bg-violet-50 text-violet-900 hover:bg-violet-100";
};
