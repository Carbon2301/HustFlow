import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";
import type { BoardMember } from "@prisma/client";

import type { CardCommentWithReplies } from "@/types";

import { getCanonicalMention } from "./mention-utils";

export type CommentItemData =
  | CardCommentWithReplies
  | CardCommentWithReplies["replies"][number];

export const REACTION_EMOJIS = ["👍", "❤️", "😂", "🎉"] as const;

export type ReactionEmoji = typeof REACTION_EMOJIS[number];

export const getInitials = (name: string) => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const initials = words.slice(0, 2).map((word) => word[0]).join("");

  return initials.toUpperCase() || "U";
};

export const getRelativeTime = (date: Date | string) => {
  const createdAt = new Date(date);
  const seconds = Math.floor((Date.now() - createdAt.getTime()) / 1000);

  if (seconds < 60) {
    return "vừa xong";
  }

  return formatDistanceToNow(createdAt, {
    addSuffix: true,
    locale: vi,
  });
};

export const getReactionCountsByCommentId = (
  items: CardCommentWithReplies[],
) => {
  const counts = new Map<string, Map<string, number>>();

  const collect = (comment: CommentItemData) => {
    const reactionCounts = new Map<string, number>();

    comment.reactions.forEach((reaction) => {
      reactionCounts.set(reaction.emoji, (reactionCounts.get(reaction.emoji) ?? 0) + 1);
    });

    counts.set(comment.id, reactionCounts);
  };

  items.forEach((comment) => {
    collect(comment);
    comment.replies.forEach(collect);
  });

  return counts;
};

export const renderCommentContent = (
  content: string,
  boardMembers: BoardMember[],
) => {
  const parts = content.split(/(@[\p{L}\p{N}_-]+)/gu);

  return parts.map((part, idx) => {
    if (part.startsWith("@")) {
      return (
        <span
          key={idx}
          className="font-semibold text-violet-600 bg-violet-50/50 px-1 rounded-xs"
        >
          {getCanonicalMention(part, boardMembers)}
        </span>
      );
    }

    return part;
  });
};
