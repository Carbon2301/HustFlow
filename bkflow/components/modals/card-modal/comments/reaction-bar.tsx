"use client";

import type { BoardMember } from "@prisma/client";
import { SmilePlus } from "lucide-react";

import { Hint } from "@/components/hint";
import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import {
  REACTION_EMOJIS,
  type CommentItemData,
  type ReactionEmoji,
} from "./comment-utils";

export const ReactionBar = ({
  comment,
  boardMembers,
  currentUserId,
  reactionCounts,
  isReacting,
  canReact,
  onToggleReaction,
}: {
  comment: CommentItemData;
  boardMembers: BoardMember[];
  currentUserId?: string;
  reactionCounts: Map<string, number>;
  isReacting: boolean;
  canReact: boolean;
  onToggleReaction: (commentId: string, emoji: ReactionEmoji) => void;
}) => {
  const getReactingUserNames = (reactionUserId: string) => {
    if (reactionUserId === currentUserId) {
      return "Bạn";
    }

    const member = boardMembers?.find((m) => m.userId === reactionUserId);
    return member ? member.userName : "Người dùng HustFlow";
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {REACTION_EMOJIS.map((emoji) => {
        const count = reactionCounts.get(emoji) ?? 0;
        if (count === 0) return null;

        const reactedByCurrentUser = comment.reactions.some(
          (reaction) => reaction.emoji === emoji && reaction.userId === currentUserId,
        );
        const tooltipText = comment.reactions
          .filter((reaction) => reaction.emoji === emoji)
          .map((reaction) => getReactingUserNames(reaction.userId))
          .join(", ");

        return (
          <Hint key={emoji} description={tooltipText} side="top">
            <button
              type="button"
              disabled={canReact && isReacting}
              aria-disabled={!canReact}
              onClick={() => {
                if (canReact) {
                  onToggleReaction(comment.id, emoji);
                }
              }}
              className={cn(
                "inline-flex h-6 items-center gap-x-1 rounded-full px-2 py-0.5 border border-neutral-200 bg-neutral-50/50 hover:bg-neutral-100 disabled:opacity-50 text-neutral-600 transition-colors select-none",
                !canReact && "cursor-default hover:bg-neutral-50/50 disabled:opacity-100",
                reactedByCurrentUser && "border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100/50",
              )}
            >
              <span className="text-[13px] leading-none">{emoji}</span>
              <span className="text-[11px] font-semibold leading-none">{count}</span>
            </button>
          </Hint>
        );
      })}

      {canReact && (
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="flex h-6 w-6 items-center justify-center rounded-full border border-neutral-200 bg-neutral-50/50 hover:bg-neutral-100 text-neutral-400 hover:text-neutral-600 transition-colors cursor-pointer"
              aria-label="Thêm cảm xúc"
            >
              <SmilePlus className="h-3.5 w-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="p-1.5 w-auto bg-white border border-neutral-200 shadow-xl rounded-full flex flex-row gap-x-1.5 z-[70]" side="top" sideOffset={6}>
            {REACTION_EMOJIS.map((emoji) => {
              const reactedByCurrentUser = comment.reactions.some(
                (reaction) => reaction.emoji === emoji && reaction.userId === currentUserId,
              );
              return (
                <PopoverClose key={emoji} asChild>
                  <button
                    type="button"
                    disabled={isReacting}
                    onClick={() => onToggleReaction(comment.id, emoji)}
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-full hover:bg-neutral-100 transition-colors text-base cursor-pointer",
                      reactedByCurrentUser && "bg-violet-100 text-violet-700 hover:bg-violet-200",
                    )}
                  >
                    {emoji}
                  </button>
                </PopoverClose>
              );
            })}
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
};
