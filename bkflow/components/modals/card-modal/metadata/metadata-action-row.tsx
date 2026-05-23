"use client";

import { CheckSquare, Clock, Paperclip, Tag, User } from "lucide-react";

import type { CardWithList } from "@/types";
import { ChecklistPopover } from "../checklists/checklist-popover";
import { LabelPopover } from "../label-popover";
import { AttachmentAddPopover } from "../attachments/attachment-add-popover";

import { CardDatePopover } from "./card-date-popover";
import { CardMemberPopover } from "./card-member-popover";

interface MetadataActionRowProps {
  data: CardWithList;
  boardId: string;
  hasDateRange: boolean;
  hasAssignees: boolean;
  hasLabels: boolean;
  isDateOpen: boolean;
  onDateOpenChange: (open: boolean) => void;
  startDateValue: string;
  dueDateValue: string;
  reminderValue: string;
  canSetReminder: boolean;
  hasStartDate: boolean;
  hasDueDate: boolean;
  isLoadingUpdate: boolean;
  onStartDateValueChange: (value: string) => void;
  onDueDateValueChange: (value: string) => void;
  onReminderValueChange: (value: string) => void;
  onDateSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onClearStartDate: () => void;
  onClearDueDate: () => void;
  isMemberOpen: boolean;
  onMemberOpenChange: (open: boolean) => void;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  boardMembers: CardWithList["boardMembers"];
  isLoadingAssign: boolean;
  isLoadingUnassign: boolean;
  onToggleMember: (memberId: string, isAssigned: boolean) => void;
}

export const MetadataActionRow = ({
  data,
  boardId,
  hasDateRange,
  hasAssignees,
  hasLabels,
  isDateOpen,
  onDateOpenChange,
  startDateValue,
  dueDateValue,
  reminderValue,
  canSetReminder,
  hasStartDate,
  hasDueDate,
  isLoadingUpdate,
  onStartDateValueChange,
  onDueDateValueChange,
  onReminderValueChange,
  onDateSubmit,
  onClearStartDate,
  onClearDueDate,
  isMemberOpen,
  onMemberOpenChange,
  searchQuery,
  onSearchQueryChange,
  boardMembers,
  isLoadingAssign,
  isLoadingUnassign,
  onToggleMember,
}: MetadataActionRowProps) => {
  return (
    <div className="flex flex-wrap items-center gap-2 mt-1">
      {/* Ngày Button (Only shown when no schedule is set) */}
      {!hasDateRange && (
        <CardDatePopover
          open={isDateOpen}
          onOpenChange={onDateOpenChange}
          startDateValue={startDateValue}
          dueDateValue={dueDateValue}
          reminderValue={reminderValue}
          canSetReminder={canSetReminder}
          hasStartDate={hasStartDate}
          hasDueDate={hasDueDate}
          isLoadingUpdate={isLoadingUpdate}
          onStartDateValueChange={onStartDateValueChange}
          onDueDateValueChange={onDueDateValueChange}
          onReminderValueChange={onReminderValueChange}
          onSubmit={onDateSubmit}
          onClearStartDate={onClearStartDate}
          onClearDueDate={onClearDueDate}
          trigger={(
            <button
              type="button"
              className="rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 active:bg-neutral-100 text-neutral-600 px-3 py-1.5 flex items-center gap-x-1.5 text-xs font-semibold shadow-xs cursor-pointer transition-colors h-8"
            >
              <Clock className="h-3.5 w-3.5 text-neutral-500" />
              Ngày
            </button>
          )}
        />
      )}

      {/* Thành viên Button (Only shown when card has no assignees) */}
      {!hasAssignees && (
        <CardMemberPopover
          open={isMemberOpen}
          onOpenChange={onMemberOpenChange}
          searchQuery={searchQuery}
          onSearchQueryChange={onSearchQueryChange}
          boardMembers={boardMembers}
          assignees={data.assignees}
          isLoadingAssign={isLoadingAssign}
          isLoadingUnassign={isLoadingUnassign}
          onToggleMember={onToggleMember}
          trigger={(
            <button
              type="button"
              className="rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 active:bg-neutral-100 text-neutral-600 px-3 py-1.5 flex items-center gap-x-1.5 text-xs font-semibold shadow-xs cursor-pointer transition-colors h-8"
            >
              <User className="h-3.5 w-3.5 text-neutral-500" />
              Thành viên
            </button>
          )}
        />
      )}

      {/* Nhãn Button (Only shown when card has no labels) */}
      {!hasLabels && (
        <LabelPopover
          cardId={data.id}
          boardId={boardId}
          labels={data.labels}
          boardLabels={data.boardLabels}
        >
          <button
            type="button"
            className="rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 active:bg-neutral-100 text-neutral-600 px-3 py-1.5 flex items-center gap-x-1.5 text-xs font-semibold shadow-xs cursor-pointer transition-colors h-8"
          >
            <Tag className="h-3.5 w-3.5 text-neutral-500" />
            Nhãn
          </button>
        </LabelPopover>
      )}

      {/* Việc cần làm Button */}
      <ChecklistPopover
        cardId={data.id}
        boardId={boardId}
        boardChecklists={data.boardChecklists || []}
      >
        <button
          type="button"
          className="rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 active:bg-neutral-100 text-neutral-600 px-3 py-1.5 flex items-center gap-x-1.5 text-xs font-semibold shadow-xs cursor-pointer transition-colors h-8"
        >
          <CheckSquare className="h-3.5 w-3.5 text-neutral-500" />
          Việc cần làm
        </button>
      </ChecklistPopover>

      {/* Tệp đính kèm Button */}
      <AttachmentAddPopover cardId={data.id} boardId={boardId} side="bottom" align="start">
        <button
          type="button"
          className="rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 active:bg-neutral-100 text-neutral-600 px-3 py-1.5 flex items-center gap-x-1.5 text-xs font-semibold shadow-xs cursor-pointer transition-colors h-8"
        >
          <Paperclip className="h-3.5 w-3.5 text-neutral-500" />
          Đính kèm
        </button>
      </AttachmentAddPopover>
    </div>
  );
};
