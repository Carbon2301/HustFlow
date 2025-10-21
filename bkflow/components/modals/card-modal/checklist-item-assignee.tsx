"use client";

import { useMemo, useState } from "react";
import { BoardMember } from "@prisma/client";
import { Check, Search, UserPlus, X } from "lucide-react";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Hint } from "@/components/hint";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface ChecklistItemAssigneeProps {
  assignee: BoardMember | null;
  boardMembers: BoardMember[];
  isPending: boolean;
  onChange: (assigneeId: string | null) => void;
}

const getInitials = (name: string) => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const initials = words.slice(0, 2).map((word) => word[0]).join("");

  return initials.toUpperCase() || "U";
};

export const ChecklistItemAssignee = ({
  assignee,
  boardMembers,
  isPending,
  onChange,
}: ChecklistItemAssigneeProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filteredMembers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return boardMembers;
    }

    return boardMembers.filter((member) => (
      member.userName.toLowerCase().includes(normalizedQuery) ||
      (member.userEmail?.toLowerCase().includes(normalizedQuery) ?? false)
    ));
  }, [boardMembers, query]);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <Hint description={assignee ? assignee.userName : "Gán thành viên"}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={isPending}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-500 transition hover:bg-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 disabled:opacity-50"
            aria-label={assignee ? `Đổi người phụ trách ${assignee.userName}` : "Gán thành viên"}
          >
            {assignee ? (
              <Avatar className="h-7 w-7">
                <AvatarImage src={assignee.userImage} alt={assignee.userName} />
                <AvatarFallback className="text-[10px] font-semibold">
                  {getInitials(assignee.userName)}
                </AvatarFallback>
              </Avatar>
            ) : (
              <UserPlus className="h-3.5 w-3.5" />
            )}
          </button>
        </PopoverTrigger>
      </Hint>
      <PopoverContent
        align="end"
        sideOffset={6}
        className="z-[9999] w-[min(280px,calc(100vw-2rem))] rounded-xl border border-neutral-200 bg-white p-3 shadow-xl"
        onEscapeKeyDown={() => setIsOpen(false)}
      >
        <div className="mb-2 flex items-center justify-between border-b border-neutral-100 pb-2">
          <span className="text-sm font-semibold text-neutral-700">Thành viên</span>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={() => setIsOpen(false)}
            aria-label="Dong"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="relative mb-2.5">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-neutral-400" />
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm thành viên"
            className="h-8.5 w-full rounded-lg border border-neutral-200 bg-neutral-50 py-1.5 pl-8 pr-3 text-xs outline-none transition focus:border-violet-500 focus:bg-white focus:ring-1 focus:ring-violet-200"
          />
        </div>
        <div className="max-h-[220px] space-y-1 overflow-y-auto pr-1">
          {assignee && (
            <button
              type="button"
              disabled={isPending}
              onClick={() => {
                onChange(null);
                setIsOpen(false);
              }}
              className="flex w-full items-center gap-x-2 rounded-lg px-2 py-1.5 text-left text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
            >
              <X className="h-3.5 w-3.5" />
              Bỏ giao
            </button>
          )}
          {filteredMembers.length === 0 ? (
            <p className="py-2 text-center text-xs text-neutral-400">
              Không tìm thấy thành viên
            </p>
          ) : (
            filteredMembers.map((member) => {
              const selected = assignee?.id === member.id;

              return (
                <button
                  key={member.id}
                  type="button"
                  disabled={isPending}
                  onClick={() => {
                    onChange(member.id);
                    setIsOpen(false);
                  }}
                  className="flex w-full items-center gap-x-2.5 rounded-lg px-2 py-1.5 text-left transition hover:bg-neutral-50 disabled:opacity-50"
                >
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={member.userImage} alt={member.userName} />
                    <AvatarFallback className="text-[9px] font-bold">
                      {getInitials(member.userName)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 flex-1 truncate text-xs font-medium text-neutral-700">
                    {member.userName}
                  </span>
                  {selected && <Check className="h-3.5 w-3.5 text-violet-600" />}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
