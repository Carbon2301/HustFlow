"use client";

import type { MentionSuggestionOption } from "./mention-utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

import { getInitials } from "./comment-utils";

export const MentionSuggestions = ({
  options,
  selectedIndex,
  onSelect,
  onHover,
}: {
  options: MentionSuggestionOption[];
  selectedIndex: number;
  onSelect: (option: MentionSuggestionOption) => void;
  onHover: (index: number) => void;
}) => {
  return (
    <div className="absolute bottom-full left-0 z-[60] mb-1 w-full max-w-[320px] max-h-[220px] overflow-y-auto rounded-xl border border-neutral-200 bg-white p-1.5 shadow-xl styled-scrollbar">
      <p className="px-2 py-1 text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
        Đề xuất nhắc nhở
      </p>
      <div className="space-y-0.5 mt-1">
        {options.map((option, idx) => {
          const isActive = idx === selectedIndex;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onSelect(option)}
              onMouseEnter={() => onHover(idx)}
              className={cn(
                "w-full flex items-center gap-x-2.5 px-2.5 py-2 rounded-lg text-left transition-colors cursor-pointer text-xs font-medium",
                isActive
                  ? "bg-violet-50 text-violet-700 font-semibold"
                  : "text-neutral-700 hover:bg-neutral-50",
              )}
            >
              {option.isSpecial ? (
                <div className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-600 font-semibold text-[10px]",
                  isActive && "bg-violet-200 text-violet-700",
                )}>
                  @
                </div>
              ) : (
                <Avatar className="h-6 w-6">
                  <AvatarImage src={option.image ?? undefined} alt={option.name} />
                  <AvatarFallback className="text-[9px] font-bold">
                    {getInitials(option.name)}
                  </AvatarFallback>
                </Avatar>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs">{option.name}</p>
                <p className="text-[10px] text-neutral-400 font-normal">{option.tag}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
