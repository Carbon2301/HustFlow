"use client";

import { useMemo, useState, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";
import { MessageSquare, SmilePlus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BoardMember } from "@prisma/client";

import { createCardComment } from "@/actions/create-card-comment";
import { deleteCardComment } from "@/actions/delete-card-comment";
import { toggleCardCommentReaction } from "@/actions/toggle-card-comment-reaction";
import { updateCardComment } from "@/actions/update-card-comment";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverTrigger, PopoverContent, PopoverClose } from "@/components/ui/popover";
import { Hint } from "@/components/hint";
import { useAction } from "@/hooks/use-action";
import { CardCommentWithReplies } from "@/types";
import { cn } from "@/lib/utils";
import { patchBoardCardCount } from "./card-cache-utils";

interface CommentsProps {
  cardId: string;
  boardId?: string;
  items: CardCommentWithReplies[];
  boardMembers?: BoardMember[];
}

type CommentItem = CardCommentWithReplies | CardCommentWithReplies["replies"][number];

const REACTION_EMOJIS = ["👍", "❤️", "😂", "🎉"] as const;

const getInitials = (name: string) => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const initials = words.slice(0, 2).map((word) => word[0]).join("");

  return initials.toUpperCase() || "U";
};

const getRelativeTime = (date: Date | string) => {
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

const getMentionKey = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w]/g, "")
    .toLowerCase();

const getMentionTag = (member: Pick<BoardMember, "userName" | "userEmail">) => {
  const rawTag = member.userEmail?.split("@")[0] || member.userName;
  const normalizedTag = rawTag.replace(/\s+/g, "").trim();

  return `@${normalizedTag || "thanhvien"}`;
};

const getCanonicalMention = (mention: string, boardMembers: BoardMember[]) => {
  const mentionKey = getMentionKey(mention.replace(/^@/, ""));
  const matchedMember = boardMembers.find((member) => {
    const keys = [
      member.userName,
      member.userEmail?.split("@")[0],
    ].filter((value): value is string => Boolean(value));

    return keys.some((key) => getMentionKey(key) === mentionKey);
  });

  return matchedMember ? getMentionTag(matchedMember) : mention;
};

const renderCommentContent = (content: string, boardMembers: BoardMember[]) => {
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

const CommentForm = ({
  placeholder,
  initialValue = "",
  submitLabel,
  isLoading,
  onSubmit,
  onCancel,
  boardMembers = [],
}: {
  placeholder: string;
  initialValue?: string;
  submitLabel: string;
  isLoading: boolean;
  onSubmit: (content: string) => void;
  onCancel?: () => void;
  boardMembers?: BoardMember[];
}) => {
  const [content, setContent] = useState(initialValue);
  const trimmedContent = content.trim();

  const [showSuggestions, setShowSuggestions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionTriggerIndex, setMentionTriggerIndex] = useState(-1);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const suggestionOptions = useMemo(() => {
    const allOptions = [
      {
        id: "card",
        name: "Toàn bộ thành viên trong thẻ",
        tag: "@card",
        isSpecial: true,
        image: undefined,
      },
      {
        id: "board",
        name: "Toàn bộ thành viên trong bảng",
        tag: "@board",
        isSpecial: true,
        image: undefined,
      },
      ...boardMembers.map((member) => ({
        id: member.id,
        name: member.userName,
        image: member.userImage,
        tag: getMentionTag(member),
        isSpecial: false,
      })),
    ];

    if (!mentionQuery) {
      return allOptions;
    }

    const q = mentionQuery.toLowerCase();
    return allOptions.filter(
      (opt) =>
        opt.name.toLowerCase().includes(q) ||
        opt.tag.toLowerCase().includes(q)
    );
  }, [boardMembers, mentionQuery]);

  const insertSuggestion = (option: typeof suggestionOptions[number]) => {
    if (mentionTriggerIndex === -1 || !textareaRef.current) return;

    const value = content;
    const beforeMention = value.slice(0, mentionTriggerIndex);
    const afterMention = value.slice(textareaRef.current.selectionStart);
    const newContent = `${beforeMention}${option.tag} ${afterMention}`;

    setContent(newContent);
    setShowSuggestions(false);
    setMentionTriggerIndex(-1);

    const newCursorPos = mentionTriggerIndex + option.tag.length + 1;
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = event.target.value;
    setContent(value);

    const selectionStart = event.target.selectionStart;
    const textBeforeCursor = value.slice(0, selectionStart);
    const lastAtIdx = textBeforeCursor.lastIndexOf("@");

    if (lastAtIdx !== -1) {
      const charBeforeAt = lastAtIdx > 0 ? textBeforeCursor[lastAtIdx - 1] : "";
      if (charBeforeAt === "" || /\s/.test(charBeforeAt)) {
        const textAfterAt = textBeforeCursor.slice(lastAtIdx + 1);
        if (!/\s/.test(textAfterAt)) {
          setShowSuggestions(true);
          setMentionQuery(textAfterAt);
          setMentionTriggerIndex(lastAtIdx);
          setSelectedIndex(0);
          return;
        }
      }
    }

    setShowSuggestions(false);
    setMentionTriggerIndex(-1);
  };

  const handleSelect = (event: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const textarea = event.currentTarget;
    const selectionStart = textarea.selectionStart;
    const value = textarea.value;
    const textBeforeCursor = value.slice(0, selectionStart);
    const lastAtIdx = textBeforeCursor.lastIndexOf("@");

    if (lastAtIdx !== -1) {
      const charBeforeAt = lastAtIdx > 0 ? textBeforeCursor[lastAtIdx - 1] : "";
      if (charBeforeAt === "" || /\s/.test(charBeforeAt)) {
        const textAfterAt = textBeforeCursor.slice(lastAtIdx + 1);
        if (!/\s/.test(textAfterAt)) {
          setShowSuggestions(true);
          setMentionQuery(textAfterAt);
          setMentionTriggerIndex(lastAtIdx);
          return;
        }
      }
    }

    setShowSuggestions(false);
    setMentionTriggerIndex(-1);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showSuggestions || suggestionOptions.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % suggestionOptions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + suggestionOptions.length) % suggestionOptions.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      insertSuggestion(suggestionOptions[selectedIndex]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setShowSuggestions(false);
    }
  };

  return (
    <div className="relative space-y-2">
      {showSuggestions && suggestionOptions.length > 0 && (
        <div className="absolute bottom-full left-0 z-[60] mb-1 w-full max-w-[320px] max-h-[220px] overflow-y-auto rounded-xl border border-neutral-200 bg-white p-1.5 shadow-xl styled-scrollbar">
          <p className="px-2 py-1 text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
            Đề xuất nhắc nhở
          </p>
          <div className="space-y-0.5 mt-1">
            {suggestionOptions.map((option, idx) => {
              const isActive = idx === selectedIndex;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => insertSuggestion(option)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={cn(
                    "w-full flex items-center gap-x-2.5 px-2.5 py-2 rounded-lg text-left transition-colors cursor-pointer text-xs font-medium",
                    isActive 
                      ? "bg-violet-50 text-violet-700 font-semibold" 
                      : "text-neutral-700 hover:bg-neutral-50"
                  )}
                >
                  {option.isSpecial ? (
                    <div className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-600 font-semibold text-[10px]",
                      isActive && "bg-violet-200 text-violet-700"
                    )}>
                      @
                    </div>
                  ) : (
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={option.image} alt={option.name} />
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
      )}

      <Textarea
        ref={(el) => {
          textareaRef.current = el;
        }}
        value={content}
        onChange={handleChange}
        onSelect={handleSelect}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={isLoading}
        className="min-h-11 resize-none rounded-xl border-neutral-200 bg-white text-sm shadow-xs focus-visible:border-violet-400 focus-visible:ring-violet-200"
      />
      {(trimmedContent || onCancel) && (
        <div className="flex items-center gap-x-2">
          {trimmedContent && (
            <Button
              type="button"
              size="sm"
              disabled={isLoading}
              onClick={() => {
                onSubmit(content);
                if (!onCancel) {
                  setContent("");
                }
              }}
              className="h-8 rounded-lg bg-violet-600 px-4 text-xs text-white hover:bg-violet-700"
            >
              {submitLabel}
            </Button>
          )}
          {onCancel && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={isLoading}
              onClick={onCancel}
              className="h-8 rounded-lg px-3 text-xs text-neutral-500 hover:bg-neutral-100"
            >
              Hủy
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export const Comments = ({
  cardId,
  boardId,
  items,
  boardMembers = [],
}: CommentsProps) => {
  const { user } = useUser();
  const queryClient = useQueryClient();
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [replyingCommentId, setReplyingCommentId] = useState<string | null>(null);

  const invalidateComments = () => {
    queryClient.invalidateQueries({
      queryKey: ["card-comments", cardId],
    });
  };

  const { execute: executeCreateComment, isLoading: isCreating } = useAction(
    createCardComment,
    {
      onSuccess: () => {
        if (boardId) {
          patchBoardCardCount(boardId, cardId, "comments", 1);
        }
        invalidateComments();
      },
      onError: (error) => {
        toast.error(error);
      },
    },
  );

  const { execute: executeUpdateComment, isLoading: isUpdating } = useAction(
    updateCardComment,
    {
      onSuccess: () => {
        setEditingCommentId(null);
        invalidateComments();
      },
      onError: (error) => {
        toast.error(error);
      },
    },
  );

  const { execute: executeDeleteComment, isLoading: isDeleting } = useAction(
    deleteCardComment,
    {
      onSuccess: (deletedComment) => {
        const parentComment = items.find((item) => item.id === deletedComment.id);
        const deletedCount = parentComment ? 1 + parentComment.replies.length : 1;

        if (boardId) {
          patchBoardCardCount(boardId, cardId, "comments", -deletedCount);
        }
        invalidateComments();
      },
      onError: (error) => {
        toast.error(error);
      },
    },
  );

  const { execute: executeToggleReaction, isLoading: isReacting } = useAction(
    toggleCardCommentReaction,
    {
      onSuccess: () => {
        invalidateComments();
      },
      onError: (error) => {
        toast.error(error);
      },
    },
  );

  const reactionCountsByCommentId = useMemo(() => {
    const counts = new Map<string, Map<string, number>>();

    const collect = (comment: CommentItem) => {
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
  }, [items]);

  const onCreateComment = (content: string, parentId?: string | null) => {
    if (!boardId) {
      return;
    }

    executeCreateComment({
      boardId,
      cardId,
      content,
      parentId: parentId ?? null,
    });
  };

  const onUpdateComment = (commentId: string, content: string) => {
    if (!boardId) {
      return;
    }

    executeUpdateComment({
      boardId,
      cardId,
      commentId,
      content,
    });
  };

  const onDeleteComment = (commentId: string) => {
    if (!boardId) {
      return;
    }

    executeDeleteComment({
      boardId,
      cardId,
      commentId,
    });
  };

  const onToggleReaction = (commentId: string, emoji: typeof REACTION_EMOJIS[number]) => {
    if (!boardId) {
      return;
    }

    executeToggleReaction({
      boardId,
      cardId,
      commentId,
      emoji,
    });
  };

  const renderComment = (comment: CommentItem, isReply = false) => {
    const isOwner = user?.id === comment.userId;
    const isEdited = new Date(comment.updatedAt).getTime() !== new Date(comment.createdAt).getTime();
    const reactionCounts = reactionCountsByCommentId.get(comment.id) ?? new Map<string, number>();
    const isEditing = editingCommentId === comment.id;
    const isReplying = replyingCommentId === comment.id;

    return (
      <div
        key={comment.id}
        className={cn("flex gap-x-3", isReply && "ml-11")}
      >
        <Avatar className="mt-0.5 h-9 w-9 flex-shrink-0">
          <AvatarImage src={comment.userImage} alt={comment.userName} />
          <AvatarFallback className="bg-violet-100 text-sm font-semibold text-violet-700">
            {getInitials(comment.userName)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <p className="text-sm font-semibold text-neutral-900">
              {comment.userName}
            </p>
            <p className="text-xs text-neutral-400">
              {getRelativeTime(comment.createdAt)}
            </p>
            {isEdited && (
              <p className="text-xs text-neutral-400">
                đã chỉnh sửa
              </p>
            )}
          </div>

          {isEditing ? (
            <CommentForm
              placeholder="Chỉnh sửa bình luận..."
              initialValue={comment.content}
              submitLabel="Lưu"
              isLoading={isUpdating}
              onSubmit={(content) => onUpdateComment(comment.id, content)}
              onCancel={() => setEditingCommentId(null)}
              boardMembers={boardMembers}
            />
          ) : (
            <div className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm leading-relaxed text-neutral-700 shadow-xs whitespace-pre-wrap break-words">
              {renderCommentContent(comment.content, boardMembers)}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-500">
            {/* Show active reaction badges & SmilePlus emoji picker */}
            <div className="flex flex-wrap items-center gap-1.5">
              {REACTION_EMOJIS.map((emoji) => {
                const count = reactionCounts.get(emoji) ?? 0;
                if (count === 0) return null;

                const reactedByCurrentUser = comment.reactions.some(
                  (reaction) => reaction.emoji === emoji && reaction.userId === user?.id,
                );

                const getReactingUserNames = (reactionUserId: string) => {
                  if (reactionUserId === user?.id) {
                    return "Bạn";
                  }
                  const member = boardMembers?.find((m) => m.userId === reactionUserId);
                  return member ? member.userName : "Người dùng HustFlow";
                };

                const reactingUsers = comment.reactions
                  .filter((r) => r.emoji === emoji)
                  .map((r) => getReactingUserNames(r.userId));

                const tooltipText = reactingUsers.join(", ");

                return (
                  <Hint key={emoji} description={tooltipText} side="top">
                    <button
                      type="button"
                      disabled={isReacting}
                      onClick={() => onToggleReaction(comment.id, emoji)}
                      className={cn(
                        "inline-flex h-6 items-center gap-x-1 rounded-full px-2 py-0.5 border border-neutral-200 bg-neutral-50/50 hover:bg-neutral-100 disabled:opacity-50 text-neutral-600 transition-colors select-none",
                        reactedByCurrentUser && "border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100/50",
                      )}
                    >
                      <span className="text-[13px] leading-none">{emoji}</span>
                      <span className="text-[11px] font-semibold leading-none">{count}</span>
                    </button>
                  </Hint>
                );
              })}

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
                      (reaction) => reaction.emoji === emoji && reaction.userId === user?.id,
                    );
                    return (
                      <PopoverClose key={emoji} asChild>
                        <button
                          type="button"
                          disabled={isReacting}
                          onClick={() => onToggleReaction(comment.id, emoji)}
                          className={cn(
                            "flex h-7 w-7 items-center justify-center rounded-full hover:bg-neutral-100 transition-colors text-base cursor-pointer",
                            reactedByCurrentUser && "bg-violet-100 text-violet-700 hover:bg-violet-200"
                          )}
                        >
                          {emoji}
                        </button>
                      </PopoverClose>
                    );
                  })}
                </PopoverContent>
              </Popover>
            </div>

            <span>•</span>
            <button
              type="button"
              onClick={() => {
                setEditingCommentId(null);
                setReplyingCommentId(comment.id);
              }}
              className="underline-offset-2 hover:underline"
            >
              Trả lời
            </button>

            {isOwner && (
              <>
                <span>•</span>
                <button
                  type="button"
                  onClick={() => {
                    setReplyingCommentId(null);
                    setEditingCommentId(comment.id);
                  }}
                  className="underline-offset-2 hover:underline"
                >
                  Chỉnh sửa
                </button>
              </>
            )}

            <span>•</span>
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  disabled={isDeleting}
                  className="underline-offset-2 hover:underline disabled:opacity-50"
                >
                  Xóa
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-60 p-3 bg-white border border-neutral-200 shadow-xl rounded-xl z-[70]" side="top" sideOffset={6}>
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-neutral-800 leading-normal">
                    Bạn có chắc chắn muốn xóa bình luận này không? Hành động này không thể hoàn tác.
                  </p>
                  <div className="flex items-center gap-x-2">
                    <PopoverClose asChild>
                      <Button
                        size="sm"
                        onClick={() => onDeleteComment(comment.id)}
                        className="h-7 px-2.5 text-[11px] font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg cursor-pointer"
                      >
                        Xác nhận xóa
                      </Button>
                    </PopoverClose>
                    <PopoverClose asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2.5 text-[11px] text-neutral-500 hover:bg-neutral-100 rounded-lg cursor-pointer"
                      >
                        Hủy
                      </Button>
                    </PopoverClose>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {isReplying && (
            <CommentForm
              placeholder="Viết phản hồi..."
              initialValue={`${
                getMentionTag(
                  boardMembers.find((member) => member.userId === comment.userId) ?? {
                    userName: comment.userName,
                    userEmail: null,
                  },
                )
              } `}
              submitLabel="Trả lời"
              isLoading={isCreating}
              onSubmit={(content) => {
                const actualParentId = isReply
                  ? (comment as CardCommentWithReplies["replies"][number]).parentId
                  : comment.id;
                onCreateComment(content, actualParentId);
                setReplyingCommentId(null);
              }}
              onCancel={() => setReplyingCommentId(null)}
              boardMembers={boardMembers}
            />
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full border-t border-neutral-200 pt-6">
      <div className="mb-4 flex items-center gap-x-3">
        <MessageSquare className="h-5 w-5 flex-shrink-0 text-neutral-500" />
        <p className="text-base font-semibold text-neutral-800">
          Bình luận
        </p>
      </div>

      <div className="space-y-5">
        <CommentForm
          placeholder="Viết bình luận..."
          submitLabel="Gửi"
          isLoading={isCreating}
          onSubmit={(content) => onCreateComment(content)}
          boardMembers={boardMembers}
        />

        {items.length === 0 ? (
          <p className="text-sm italic text-neutral-400">
            Chưa có bình luận nào.
          </p>
        ) : (
          <div className="max-h-[350px] overflow-y-auto pr-2 space-y-5 styled-scrollbar">
            {items.map((comment) => (
              <div key={comment.id} className="space-y-4">
                {renderComment(comment)}
                {comment.replies.map((reply) => renderComment(reply, true))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

Comments.Skeleton = function CommentsSkeleton() {
  return (
    <div className="w-full border-t border-neutral-200 pt-6">
      <div className="mb-4 flex items-center gap-x-3">
        <Skeleton className="h-5 w-5 rounded bg-neutral-100" />
        <Skeleton className="h-5 w-24 rounded bg-neutral-100" />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-12 w-full rounded-xl bg-neutral-100" />
        <Skeleton className="h-20 w-full rounded-xl bg-neutral-100" />
        <Skeleton className="ml-11 h-16 w-[calc(100%-2.75rem)] rounded-xl bg-neutral-100" />
      </div>
    </div>
  );
};
