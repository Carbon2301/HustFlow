"use client";

import { Check, Search, X } from "lucide-react";

import type { CardWithList } from "@/types";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import { getInitials } from "./metadata-utils";

interface CardMemberPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger: React.ReactNode;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  boardMembers: CardWithList["boardMembers"];
  assignees: CardWithList["assignees"];
  isLoadingAssign: boolean;
  isLoadingUnassign: boolean;
  onToggleMember: (memberId: string, isAssigned: boolean) => void;
}

export const CardMemberPopover = ({
  open,
  onOpenChange,
  trigger,
  searchQuery,
  onSearchQueryChange,
  boardMembers,
  assignees,
  isLoadingAssign,
  isLoadingUnassign,
  onToggleMember,
}: CardMemberPopoverProps) => {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        {trigger}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[280px] p-3 rounded-xl border border-neutral-200 shadow-xl bg-white z-[9999]" sideOffset={6}>
        <div className="relative pb-2.5 mb-2 border-b border-neutral-100 flex items-center justify-between">
          <span className="text-sm font-semibold text-neutral-700 mx-auto">Thành viên</span>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="absolute right-0 top-0.5 text-neutral-400 hover:text-neutral-600 rounded-sm"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search input */}
        <div className="relative mb-2.5">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-neutral-400" />
          <input
            type="text"
            placeholder="Tìm kiếm các thành viên"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            className="w-full h-8.5 pl-8 pr-3 py-1.5 bg-neutral-50 hover:bg-neutral-100/50 focus:bg-white border border-neutral-200 hover:border-neutral-300 focus:border-violet-500 rounded-lg text-xs transition outline-hidden"
          />
        </div>

        <div className="space-y-1">
          <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide mb-1.5">
            Thành viên của bảng
          </p>
          <div className="max-h-[220px] overflow-y-auto space-y-1 pr-1">
            {boardMembers.length === 0 ? (
              <p className="text-xs text-neutral-400 text-center py-2">Không tìm thấy thành viên</p>
            ) : (
              boardMembers.map((member) => {
                const isAssigned = assignees?.some((a) => a.boardMemberId === member.id) ?? false;
                const isMutating = isLoadingAssign || isLoadingUnassign;

                return (
                  <button
                    key={member.id}
                    type="button"
                    disabled={isMutating}
                    onClick={() => onToggleMember(member.id, isAssigned)}
                    className="w-full flex items-center gap-x-2.5 px-2 py-1.5 hover:bg-neutral-50 rounded-lg transition text-left cursor-pointer group disabled:opacity-50"
                  >
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={member.userImage} alt={member.userName} />
                      <AvatarFallback className="text-[9px] font-bold">
                        {getInitials(member.userName)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs font-medium text-neutral-700 truncate flex-1">
                      {member.userName}
                    </span>
                    {isAssigned && (
                      <Check className="h-3.5 w-3.5 text-violet-600 flex-shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
