"use client";

import { Plus } from "lucide-react";

import type { CardWithList } from "@/types";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Hint } from "@/components/hint";

import { CardMemberPopover } from "./card-member-popover";
import { getInitials } from "./metadata-utils";

interface CardAssigneeSummaryProps {
  assignees: CardWithList["assignees"];
  isMemberOpen: boolean;
  onMemberOpenChange: (open: boolean) => void;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  boardMembers: CardWithList["boardMembers"];
  isLoadingAssign: boolean;
  isLoadingUnassign: boolean;
  onToggleMember: (memberId: string, isAssigned: boolean) => void;
  canEdit?: boolean;
}

export const CardAssigneeSummary = ({
  assignees,
  isMemberOpen,
  onMemberOpenChange,
  searchQuery,
  onSearchQueryChange,
  boardMembers,
  isLoadingAssign,
  isLoadingUnassign,
  onToggleMember,
  canEdit = true,
}: CardAssigneeSummaryProps) => {
  return (
    <div className="flex flex-col gap-y-1.5">
      <span className="text-xs font-semibold text-neutral-600 pl-0.5">
        Thành viên
      </span>
      <div className="flex flex-wrap items-center gap-1.5">
        {assignees.map((assignee) => (
          <Hint
            key={assignee.id}
            description={assignee.boardMember.userName}
          >
            <Avatar className="h-7 w-7 ring-2 ring-white shadow-xs">
              <AvatarImage
                src={assignee.boardMember.userImage}
                alt={assignee.boardMember.userName}
              />
              <AvatarFallback className="text-[9px] font-bold">
                {getInitials(assignee.boardMember.userName)}
              </AvatarFallback>
            </Avatar>
          </Hint>
        ))}

        {/* Plus button inside active state to add more */}
        {canEdit && <CardMemberPopover
          open={isMemberOpen}
          onOpenChange={onMemberOpenChange}
          searchQuery={searchQuery}
          onSearchQueryChange={onSearchQueryChange}
          boardMembers={boardMembers}
          assignees={assignees}
          isLoadingAssign={isLoadingAssign}
          isLoadingUnassign={isLoadingUnassign}
          onToggleMember={onToggleMember}
          trigger={(
            <button
              type="button"
              className="rounded-full bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 flex items-center justify-center h-7 w-7 cursor-pointer transition-colors shadow-xs"
              aria-label="Thêm thành viên"
            >
              <Plus className="h-3.5 w-3.5 text-neutral-600" />
            </button>
          )}
        />}
      </div>
    </div>
  );
};
