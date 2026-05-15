"use client";

import { useMemo, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { MessageSquare } from "lucide-react";
import type { BoardMember, BoardMemberRole } from "@prisma/client";

import { Skeleton } from "@/components/ui/skeleton";
import type { CardCommentWithReplies } from "@/types";

import { CommentEditor } from "./comment-editor";
import { CommentItem } from "./comment-item";
import { getReactionCountsByCommentId } from "./comment-utils";
import { useCommentsActions } from "./use-comments-actions";

interface CommentsProps {
  cardId: string;
  boardId?: string;
  items: CardCommentWithReplies[];
  boardMembers?: BoardMember[];
  currentMemberRole?: BoardMemberRole;
}

export const CommentsSection = ({
  cardId,
  boardId,
  items,
  boardMembers = [],
  currentMemberRole,
}: CommentsProps) => {
  const { user } = useUser();
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [replyingCommentId, setReplyingCommentId] = useState<string | null>(null);
  const {
    isCreating,
    isUpdating,
    isDeleting,
    isReacting,
    onCreateComment,
    onUpdateComment,
    onDeleteComment,
    onToggleReaction,
  } = useCommentsActions({
    cardId,
    boardId,
    items,
    onEditComplete: () => setEditingCommentId(null),
  });
  const reactionCountsByCommentId = useMemo(
    () => getReactionCountsByCommentId(items),
    [items],
  );

  return (
    <div className="w-full border-t border-neutral-200 pt-6">
      <div className="mb-4 flex items-center gap-x-3">
        <MessageSquare className="h-5 w-5 flex-shrink-0 text-neutral-500" />
        <p className="text-base font-semibold text-neutral-800">
          Bình luận
        </p>
      </div>

      <div className="space-y-5">
        <CommentEditor
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
                <CommentItem
                  comment={comment}
                  currentUserId={user?.id}
                  currentMemberRole={currentMemberRole}
                  boardMembers={boardMembers}
                  reactionCounts={reactionCountsByCommentId.get(comment.id) ?? new Map()}
                  editingCommentId={editingCommentId}
                  replyingCommentId={replyingCommentId}
                  isCreating={isCreating}
                  isUpdating={isUpdating}
                  isDeleting={isDeleting}
                  isReacting={isReacting}
                  onSetEditingCommentId={setEditingCommentId}
                  onSetReplyingCommentId={setReplyingCommentId}
                  onCreateComment={onCreateComment}
                  onUpdateComment={onUpdateComment}
                  onDeleteComment={onDeleteComment}
                  onToggleReaction={onToggleReaction}
                />
                {comment.replies.map((reply) => (
                  <CommentItem
                    key={reply.id}
                    comment={reply}
                    isReply
                    currentUserId={user?.id}
                    currentMemberRole={currentMemberRole}
                    boardMembers={boardMembers}
                    reactionCounts={reactionCountsByCommentId.get(reply.id) ?? new Map()}
                    editingCommentId={editingCommentId}
                    replyingCommentId={replyingCommentId}
                    isCreating={isCreating}
                    isUpdating={isUpdating}
                    isDeleting={isDeleting}
                    isReacting={isReacting}
                    onSetEditingCommentId={setEditingCommentId}
                    onSetReplyingCommentId={setReplyingCommentId}
                    onCreateComment={onCreateComment}
                    onUpdateComment={onUpdateComment}
                    onDeleteComment={onDeleteComment}
                    onToggleReaction={onToggleReaction}
                  />
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

CommentsSection.Skeleton = function CommentsSkeleton() {
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
