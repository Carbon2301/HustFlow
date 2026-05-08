"use client";

import { useState, useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { CardWithList } from "@/types";
import { Skeleton } from "@/components/ui/skeleton";
import { getDueDateStatus } from "@/components/due-date-badge";
import { formatDateTimeLocalInput } from "@/lib/date-utils";
import { useBoardCalendarInvalidation } from "@/hooks/use-board-calendar-invalidation";

import { CardAssigneeSummary } from "./card-assignee-summary";
import { CardDateStatusColumn } from "./card-date-status-column";
import { CardLabelSummary } from "./card-label-summary";
import { MetadataActionRow } from "./metadata-action-row";
import {
  getDateSummary,
  getFilteredBoardMembers,
} from "./metadata-utils";
import { useCardMetadataActions } from "./use-card-metadata-actions";

interface MetadataProps {
  data: CardWithList;
  canEdit?: boolean;
}

export const MetadataSection = ({
  data,
  canEdit = true,
}: MetadataProps) => {
  const boardId = data.list.boardId;
  const queryClient = useQueryClient();
  const invalidateBoardCalendar = useBoardCalendarInvalidation(boardId);

  const [searchQuery, setSearchQuery] = useState("");
  const [startDateValue, setStartDateValue] = useState(formatDateTimeLocalInput(data.startDate));
  const [dueDateValue, setDueDateValue] = useState(formatDateTimeLocalInput(data.dueDate));
  const [reminderValue, setReminderValue] = useState(data.reminder || "none");

  const [isDateOpen, setIsDateOpen] = useState(false);
  const [isMemberOpen, setIsMemberOpen] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStartDateValue(formatDateTimeLocalInput(data.startDate));
    setDueDateValue(formatDateTimeLocalInput(data.dueDate));
    setReminderValue(data.reminder || "none");
  }, [data.startDate, data.dueDate, data.reminder]);

  const {
    isLoadingUpdate,
    isLoadingAssign,
    isLoadingUnassign,
    updateDueDate,
    updateStartDate,
    onDateSubmit,
    handleMemberToggle,
  } = useCardMetadataActions({
    data,
    boardId,
    queryClient,
    invalidateBoardCalendar,
    reminderValue,
    setIsDateOpen,
  });

  const filteredBoardMembers = getFilteredBoardMembers(data.boardMembers, searchQuery);
  const unresolvedBlockers = useMemo(
    () => data.blockedByDependencies.filter(
      (dependency) => !dependency.blockerCard.isCompleted,
    ),
    [data.blockedByDependencies],
  );

  const hasAssignees = data.assignees && data.assignees.length > 0;
  const hasStartDate = !!data.startDate;
  const hasDueDate = !!data.dueDate;
  const hasDateRange = hasStartDate || hasDueDate;
  const hasLabels = data.labels && data.labels.length > 0;
  const canSetReminder = !!dueDateValue;

  const status = data.dueDate ? getDueDateStatus(data.dueDate) : "normal";
  const dateSummary = getDateSummary({
    startDate: data.startDate,
    dueDate: data.dueDate,
    hasStartDate,
    hasDueDate,
  });

  const showActionButtonRow = canEdit;

  return (
    <div className="space-y-5">

      {/* 1. Action Button Row */}
      {showActionButtonRow && (
        <MetadataActionRow
          data={data}
          boardId={boardId}
          hasDateRange={hasDateRange}
          hasAssignees={hasAssignees}
          hasLabels={hasLabels}
          isDateOpen={isDateOpen}
          onDateOpenChange={setIsDateOpen}
          startDateValue={startDateValue}
          dueDateValue={dueDateValue}
          reminderValue={reminderValue}
          canSetReminder={canSetReminder}
          hasStartDate={hasStartDate}
          hasDueDate={hasDueDate}
          isLoadingUpdate={isLoadingUpdate}
          onStartDateValueChange={setStartDateValue}
          onDueDateValueChange={setDueDateValue}
          onReminderValueChange={setReminderValue}
          onDateSubmit={onDateSubmit}
          onClearStartDate={() => updateStartDate(null)}
          onClearDueDate={() => updateDueDate(null)}
          isMemberOpen={isMemberOpen}
          onMemberOpenChange={setIsMemberOpen}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          boardMembers={filteredBoardMembers}
          isLoadingAssign={isLoadingAssign}
          isLoadingUnassign={isLoadingUnassign}
          onToggleMember={handleMemberToggle}
        />
      )}

      {/* 2. Metadata Display Row (Columns) */}
      <div className="flex flex-wrap gap-x-8 gap-y-4 pt-1">
        {/* Column A: Thành viên (Active State) */}
        {hasAssignees && (
          <CardAssigneeSummary
            assignees={data.assignees}
            isMemberOpen={isMemberOpen}
            onMemberOpenChange={setIsMemberOpen}
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            boardMembers={filteredBoardMembers}
            isLoadingAssign={isLoadingAssign}
            isLoadingUnassign={isLoadingUnassign}
            onToggleMember={handleMemberToggle}
          />
        )}

        {/* Column B: Nhãn (Active State) */}
        {hasLabels && (
          <CardLabelSummary
            cardId={data.id}
            boardId={boardId}
            labels={data.labels}
            boardLabels={data.boardLabels}
            canEdit={canEdit}
          />
        )}

        {/* Column C: Ngày / Trạng thái */}
        <CardDateStatusColumn
          data={data}
          hasDateRange={hasDateRange}
          hasStartDate={hasStartDate}
          hasDueDate={hasDueDate}
          dateSummary={dateSummary}
          status={status}
          isLoadingUpdate={isLoadingUpdate}
          onToggleComplete={() => {}}
          isDateOpen={isDateOpen}
          onDateOpenChange={setIsDateOpen}
          startDateValue={startDateValue}
          dueDateValue={dueDateValue}
          reminderValue={reminderValue}
          canSetReminder={canSetReminder}
          onStartDateValueChange={setStartDateValue}
          onDueDateValueChange={setDueDateValue}
          onReminderValueChange={setReminderValue}
          onDateSubmit={onDateSubmit}
          onClearStartDate={() => updateStartDate(null)}
          onClearDueDate={() => updateDueDate(null)}
          canEdit={canEdit}
        />
      </div>
    </div>
  );
};

MetadataSection.Skeleton = function MetadataSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mt-1">
        <Skeleton className="w-16 h-8 rounded-lg bg-neutral-100" />
        <Skeleton className="w-16 h-8 rounded-lg bg-neutral-100" />
      </div>
      <div className="flex flex-wrap gap-x-8 gap-y-4">
        <div className="space-y-2">
          <Skeleton className="w-16 h-3 rounded bg-neutral-100" />
          <div className="flex items-center gap-x-1.5">
            <Skeleton className="w-7 h-7 rounded-full bg-neutral-100" />
            <Skeleton className="w-7 h-7 rounded-full bg-neutral-100" />
          </div>
        </div>
        <div className="space-y-2">
          <Skeleton className="w-20 h-3 rounded bg-neutral-100" />
          <div className="flex items-center gap-x-2">
            <Skeleton className="w-4.5 h-4.5 rounded bg-neutral-100" />
            <Skeleton className="w-32 h-8 rounded-lg bg-neutral-100" />
          </div>
        </div>
      </div>
    </div>
  );
};
