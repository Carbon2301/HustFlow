import { isAfter } from "date-fns";

import type {
  BoardTimelineCard,
} from "@/types";

import type {
  DependencyLine,
  ScheduledCard,
} from "../_types";
import { parseCardDateTime } from "./date-utils";

export type TimelineDependencyRect = {
  left: number;
  right: number;
  top: number;
  height: number;
};

export const getDependencyConflicts = (card: BoardTimelineCard) => {
  const blockeeStart = parseCardDateTime(card.startDate);

  if (!blockeeStart) {
    return [];
  }

  return card.blockedByDependencies.filter((blocker) => {
    const blockerDue = parseCardDateTime(blocker.dueDate);

    return Boolean(blockerDue && !blocker.isCompleted && isAfter(blockerDue, blockeeStart));
  });
};

export const getDependencyPreview = (card: BoardTimelineCard) => {
  const conflictCount = getDependencyConflicts(card).length;

  return {
    unresolvedBlockerCount: card.unresolvedBlockerCount,
    conflictCount,
    hasBlockers: card.unresolvedBlockerCount > 0,
    hasConflict: conflictCount > 0,
  };
};

export const getDependencyPreviewLabel = (card: BoardTimelineCard) => {
  const preview = getDependencyPreview(card);
  const parts = [];

  if (preview.hasBlockers) {
    parts.push(`${preview.unresolvedBlockerCount} thẻ chặn chưa hoàn thành`);
  }

  if (preview.hasConflict) {
    parts.push(`${preview.conflictCount} xung đột lịch phụ thuộc`);
  }

  return parts.join(". ");
};

export const hasDependencyLineConflict = (
  sourceCard: BoardTimelineCard,
  targetCard: BoardTimelineCard,
) => {
  const sourceDueDate = parseCardDateTime(sourceCard.dueDate);
  const targetStartDate = parseCardDateTime(targetCard.startDate);

  return Boolean(
    sourceDueDate &&
    targetStartDate &&
    !sourceCard.isCompleted &&
    isAfter(sourceDueDate, targetStartDate),
  );
};

export const getDependencyLineModels = ({
  rows,
  rowsByCardId,
  rectsByCardId,
  contentRect,
}: {
  rows: ScheduledCard[];
  rowsByCardId: Map<string, ScheduledCard>;
  rectsByCardId: Map<string, TimelineDependencyRect>;
  contentRect: Pick<TimelineDependencyRect, "left" | "top">;
}): DependencyLine[] => {
  const nextLines: DependencyLine[] = [];

  rows.forEach((sourceRow) => {
    const sourceRect = rectsByCardId.get(sourceRow.card.id);

    if (!sourceRect) {
      return;
    }

    sourceRow.card.blockingDependencies.forEach((dependency) => {
      const targetRow = rowsByCardId.get(dependency.cardId);

      if (!targetRow) {
        return;
      }

      const targetRect = rectsByCardId.get(targetRow.card.id);

      if (!targetRect) {
        return;
      }

      nextLines.push({
        key: `${sourceRow.card.id}:${dependency.id}:${targetRow.card.id}`,
        sourceId: sourceRow.card.id,
        targetId: targetRow.card.id,
        sourceTitle: sourceRow.card.title,
        targetTitle: targetRow.card.title,
        x1: sourceRect.right - contentRect.left,
        y1: sourceRect.top - contentRect.top + sourceRect.height / 2,
        x2: targetRect.left - contentRect.left,
        y2: targetRect.top - contentRect.top + targetRect.height / 2,
        hasConflict: hasDependencyLineConflict(sourceRow.card, targetRow.card),
      });
    });
  });

  return nextLines;
};
