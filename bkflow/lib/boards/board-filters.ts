import type { BoardFilterState } from "@/hooks/use-board-filters";
import type {
  BoardCalendarItem,
  BoardCalendarUnscheduledCard,
  CardWithAssignees,
} from "@/types";

import {
  getEndOfTomorrow,
  getStartOfTomorrow,
  isOverdue,
} from "../date-utils";

type FilterableAssignee = {
  boardMemberId: string;
};

type FilterableLabel = {
  id?: string;
  labelId?: string;
};

type FilterableCard = {
  listId: string;
  dueDate: Date | string | null;
  isCompleted: boolean;
  assignees: FilterableAssignee[];
  labels?: FilterableLabel[];
};

const hasActiveListFilters = (filters: BoardFilterState) =>
  filters.selectedListIds.length > 0;

const hasActiveMemberFilters = (filters: BoardFilterState) =>
  filters.selectedMemberIds.length > 0 ||
  filters.myWorkEnabled ||
  filters.noMembersEnabled;

const hasActiveStatusFilters = (filters: BoardFilterState) =>
  filters.completedEnabled || filters.notCompletedEnabled;

const hasActiveDueDateFilters = (filters: BoardFilterState) =>
  filters.selectedDueDateFilters.length > 0;

const hasActiveLabelFilters = (filters: BoardFilterState) =>
  filters.selectedLabelIds.length > 0 || filters.noLabelsEnabled;

export const boardFiltersAreActive = (filters: BoardFilterState) =>
  hasActiveListFilters(filters) ||
  hasActiveMemberFilters(filters) ||
  hasActiveStatusFilters(filters) ||
  hasActiveDueDateFilters(filters) ||
  hasActiveLabelFilters(filters);

const labelIdMatches = (label: FilterableLabel, labelIds: string[]) => {
  const id = label.labelId ?? label.id;

  return !!id && labelIds.includes(id);
};

const matchesListFilters = (listId: string, filters: BoardFilterState) => {
  if (!hasActiveListFilters(filters)) {
    return true;
  }

  return filters.selectedListIds.includes(listId);
};

const matchesMemberFilters = (
  assignees: FilterableAssignee[],
  filters: BoardFilterState,
  currentBoardMemberId?: string,
) => {
  if (!hasActiveMemberFilters(filters)) {
    return true;
  }

  return (
    (filters.noMembersEnabled && assignees.length === 0) ||
    (
      filters.myWorkEnabled &&
      !!currentBoardMemberId &&
      assignees.some((assignee) => assignee.boardMemberId === currentBoardMemberId)
    ) ||
    (
      filters.selectedMemberIds.length > 0 &&
      assignees.some((assignee) =>
        filters.selectedMemberIds.includes(assignee.boardMemberId),
      )
    )
  );
};

const matchesStatusFilters = (
  isCompleted: boolean,
  filters: BoardFilterState,
) => {
  if (!hasActiveStatusFilters(filters)) {
    return true;
  }

  return (
    (filters.completedEnabled && isCompleted) ||
    (filters.notCompletedEnabled && !isCompleted)
  );
};

const matchesDueDateFilters = ({
  dueDate,
  isCompleted,
  filters,
  allowNoDue,
}: {
  dueDate: Date | string | null;
  isCompleted: boolean;
  filters: BoardFilterState;
  allowNoDue: boolean;
}) => {
  if (!hasActiveDueDateFilters(filters)) {
    return true;
  }

  const now = new Date();

  return filters.selectedDueDateFilters.some((filterType) => {
    if (filterType === "no-due") {
      return allowNoDue && !dueDate;
    }

    if (!dueDate) {
      return false;
    }

    const parsedDueDate = new Date(dueDate);

    if (Number.isNaN(parsedDueDate.getTime())) {
      return false;
    }

    if (filterType === "overdue") {
      return isOverdue(parsedDueDate, now) && !isCompleted;
    }

    if (filterType === "next-hour") {
      const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

      return parsedDueDate.getTime() >= now.getTime() &&
        parsedDueDate.getTime() <= oneHourFromNow.getTime();
    }

    if (filterType === "tomorrow") {
      const startOfTomorrow = getStartOfTomorrow(now);
      const endOfTomorrow = getEndOfTomorrow(now);

      return parsedDueDate.getTime() >= startOfTomorrow.getTime() &&
        parsedDueDate.getTime() <= endOfTomorrow.getTime();
    }

    if (filterType === "next-week") {
      const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      return parsedDueDate.getTime() >= now.getTime() &&
        parsedDueDate.getTime() <= sevenDaysFromNow.getTime();
    }

    if (filterType === "next-month") {
      const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      return parsedDueDate.getTime() >= now.getTime() &&
        parsedDueDate.getTime() <= thirtyDaysFromNow.getTime();
    }

    return false;
  });
};

const matchesLabelFilters = (
  labels: FilterableLabel[] | undefined,
  filters: BoardFilterState,
) => {
  if (!hasActiveLabelFilters(filters)) {
    return true;
  }

  const itemLabels = labels ?? [];

  return (
    (filters.noLabelsEnabled && itemLabels.length === 0) ||
    (
      filters.selectedLabelIds.length > 0 &&
      itemLabels.some((label) => labelIdMatches(label, filters.selectedLabelIds))
    )
  );
};

export const cardMatchesBoardFilters = (
  card: CardWithAssignees,
  filters: BoardFilterState,
  currentBoardMemberId?: string,
) => matchesFilterableCard(card, filters, currentBoardMemberId);

export const filterableCardMatchesBoardFilters = (
  card: FilterableCard,
  filters: BoardFilterState,
  currentBoardMemberId?: string,
) => matchesFilterableCard(card, filters, currentBoardMemberId);

const matchesFilterableCard = (
  card: FilterableCard,
  filters: BoardFilterState,
  currentBoardMemberId?: string,
) =>
  matchesListFilters(card.listId, filters) &&
  matchesMemberFilters(card.assignees, filters, currentBoardMemberId) &&
  matchesStatusFilters(card.isCompleted, filters) &&
  matchesDueDateFilters({
    dueDate: card.dueDate,
    isCompleted: card.isCompleted,
    filters,
    allowNoDue: true,
  }) &&
  matchesLabelFilters(card.labels, filters);

export const calendarItemMatchesBoardFilters = (
  item: BoardCalendarItem,
  filters: BoardFilterState,
  currentBoardMemberId?: string,
) => {
  const assignees = item.type === "card"
    ? item.assignees
    : item.assignee
      ? [item.assignee]
      : [];
  const labels = item.type === "card" ? item.labels : item.labels;

  return (
    matchesListFilters(item.listId, filters) &&
    matchesMemberFilters(assignees, filters, currentBoardMemberId) &&
    matchesStatusFilters(item.isCompleted, filters) &&
    matchesDueDateFilters({
      dueDate: item.dueDate,
      isCompleted: item.isCompleted,
      filters,
      allowNoDue: false,
    }) &&
    matchesLabelFilters(labels, filters)
  );
};

export const unscheduledCardMatchesBoardFilters = (
  card: BoardCalendarUnscheduledCard,
  filters: BoardFilterState,
  currentBoardMemberId?: string,
) => {
  if (hasActiveDueDateFilters(filters)) {
    const hasNoDueOnly = filters.selectedDueDateFilters.every(
      (filterType) => filterType === "no-due",
    );

    if (!hasNoDueOnly) {
      return false;
    }
  }

  return (
    matchesListFilters(card.listId, filters) &&
    matchesMemberFilters(card.assignees, filters, currentBoardMemberId) &&
    matchesStatusFilters(card.isCompleted, filters) &&
    matchesLabelFilters(card.labels, filters)
  );
};
