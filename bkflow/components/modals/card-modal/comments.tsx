"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";
import { MessageSquare } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { createCardComment } from "@/actions/create-card-comment";
import { deleteCardComment } from "@/actions/delete-card-comment";
import { toggleCardCommentReaction } from "@/actions/toggle-card-comment-reaction";
import { updateCardComment } from "@/actions/update-card-comment";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useAction } from "@/hooks/use-action";
import { CardCommentWithReplies } from "@/types";
import { cn } from "@/lib/utils";

interface CommentsProps {
  cardId: string;
  items: CardCommentWithReplies[];
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

const getMention = (name: string) => {
  const normalizedName = name.replace(/\s+/g, "").trim();

  return `@${normalizedName || "thanhvien"}`;
};

const CommentForm = ({
  placeholder,
  initialValue = "",
  submitLabel,
  isLoading,
  onSubmit,
  onCancel,
}: {
  placeholder: string;
  initialValue?: string;
  submitLabel: string;
  isLoading: boolean;
  onSubmit: (content: string) => void;
  onCancel?: () => void;
}) => {
  const [content, setContent] = useState(initialValue);
  const trimmedContent = content.trim();

  return (
    <div className="space-y-2">
      <Textarea
        value={content}
        onChange={(event) => setContent(event.target.value)}
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
  items,
}: CommentsProps) => {
  const params = useParams();
  const { user } = useUser();
  const queryClient = useQueryClient();
  const boardId = params.boardId as string;
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
      onSuccess: () => {
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
    executeCreateComment({
      boardId,
      cardId,
      content,
      parentId: parentId ?? null,
    });
  };

  const onUpdateComment = (commentId: string, content: string) => {
    executeUpdateComment({
      boardId,
      cardId,
      commentId,
      content,
    });
  };

  const onDeleteComment = (commentId: string) => {
    executeDeleteComment({
      boardId,
      cardId,
      commentId,
    });
  };

  const onToggleReaction = (commentId: string, emoji: typeof REACTION_EMOJIS[number]) => {
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
            />
          ) : (
            <div className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm leading-relaxed text-neutral-700 shadow-xs whitespace-pre-wrap break-words">
              {comment.content}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-500">
            <div className="flex items-center gap-x-1">
              {REACTION_EMOJIS.map((emoji) => {
                const count = reactionCounts.get(emoji) ?? 0;
                const reactedByCurrentUser = comment.reactions.some(
                  (reaction) => reaction.emoji === emoji && reaction.userId === user?.id,
                );

                return (
                  <button
                    key={emoji}
                    type="button"
                    disabled={isReacting}
                    onClick={() => onToggleReaction(comment.id, emoji)}
                    className={cn(
                      "inline-flex h-6 items-center gap-x-1 rounded-full px-1.5 transition hover:bg-neutral-100 disabled:opacity-50",
                      reactedByCurrentUser && "bg-violet-50 text-violet-700",
                    )}
                  >
                    <span>{emoji}</span>
                    {count > 0 && <span>{count}</span>}
                  </button>
                );
              })}
            </div>

            {!isReply && (
              <>
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
              </>
            )}

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
            <button
              type="button"
              disabled={isDeleting}
              onClick={() => onDeleteComment(comment.id)}
              className="underline-offset-2 hover:underline disabled:opacity-50"
            >
              Xóa
            </button>
          </div>

          {isReplying && !isReply && (
            <CommentForm
              placeholder="Viết phản hồi..."
              initialValue={`${getMention(comment.userName)} `}
              submitLabel="Trả lời"
              isLoading={isCreating}
              onSubmit={(content) => {
                onCreateComment(content, comment.id);
                setReplyingCommentId(null);
              }}
              onCancel={() => setReplyingCommentId(null)}
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
