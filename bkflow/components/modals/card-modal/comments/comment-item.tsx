"use client";

import { BoardMemberRole, type BoardMember } from "@prisma/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useHasMounted } from "@/hooks/use-has-mounted";
import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { CardCommentWithReplies } from "@/types";

import { CommentEditor } from "./comment-editor";
import {
  getInitials,
  getRelativeTime,
  renderCommentContent,
  type CommentItemData,
  type ReactionEmoji,
} from "./comment-utils";
import { getMentionTag } from "./mention-utils";
import { ReactionBar } from "./reaction-bar";

export const CommentItem = ({
  comment,
  isReply = false,
  canWriteComments,
  currentUserId,
  currentMemberRole,
  boardMembers,
  reactionCounts,
  editingCommentId,
  replyingCommentId,
  isCreating,
  isUpdating,
  isDeleting,
  isReacting,
  onSetEditingCommentId,
  onSetReplyingCommentId,
  onCreateComment,
  onUpdateComment,
  onDeleteComment,
  onToggleReaction,
}: {
  comment: CommentItemData;
  isReply?: boolean;
  canWriteComments: boolean;
  currentUserId?: string;
  currentMemberRole?: BoardMemberRole;
  boardMembers: BoardMember[];
  reactionCounts: Map<string, number>;
  editingCommentId: string | null;
  replyingCommentId: string | null;
  isCreating: boolean;
  isUpdating: boolean;
  isDeleting: boolean;
  isReacting: boolean;
  onSetEditingCommentId: (commentId: string | null) => void;
  onSetReplyingCommentId: (commentId: string | null) => void;
  onCreateComment: (content: string, parentId?: string | null) => void;
  onUpdateComment: (commentId: string, content: string) => void;
  onDeleteComment: (commentId: string) => void;
  onToggleReaction: (commentId: string, emoji: ReactionEmoji) => void;
}) => {
  const hasMounted = useHasMounted();
  const isOwner = currentUserId === comment.userId;
  const canEditOwnComment = canWriteComments && isOwner;
  const canDeleteComment =
    canWriteComments && (isOwner || currentMemberRole === BoardMemberRole.ADMIN);
  const canReply = canWriteComments;
  const isEdited = new Date(comment.updatedAt).getTime() !== new Date(comment.createdAt).getTime();
  const isEditing = canEditOwnComment && editingCommentId === comment.id;
  const isReplying = replyingCommentId === comment.id;

  return (
    <div
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
            {hasMounted ? getRelativeTime(comment.createdAt) : ""}
          </p>
          {isEdited && (
            <p className="text-xs text-neutral-400">
              đã chỉnh sửa
            </p>
          )}
        </div>

        {isEditing ? (
          <CommentEditor
            placeholder="Chỉnh sửa bình luận..."
            initialValue={comment.content}
            submitLabel="Lưu"
            isLoading={isUpdating}
            onSubmit={(content) => onUpdateComment(comment.id, content)}
            onCancel={() => onSetEditingCommentId(null)}
            boardMembers={boardMembers}
          />
        ) : (
          <div className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm leading-relaxed text-neutral-700 shadow-xs whitespace-pre-wrap break-words">
            {renderCommentContent(comment.content, boardMembers)}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-500">
          <ReactionBar
            comment={comment}
            boardMembers={boardMembers}
            currentUserId={currentUserId}
            reactionCounts={reactionCounts}
            isReacting={isReacting}
            canReact={canWriteComments}
            onToggleReaction={onToggleReaction}
          />
          {canReply && (
            <>
              <span>•</span>
              <button
                type="button"
                onClick={() => {
                  onSetEditingCommentId(null);
                  onSetReplyingCommentId(comment.id);
                }}
                className="underline-offset-2 hover:underline"
              >
                Trả lời
              </button>
            </>
          )}

          {canEditOwnComment && (
            <>
              <span>•</span>
              <button
                type="button"
                onClick={() => {
                  onSetReplyingCommentId(null);
                  onSetEditingCommentId(comment.id);
                }}
                className="underline-offset-2 hover:underline"
              >
                Chỉnh sửa
              </button>
            </>
          )}

          {canDeleteComment && (
            <>
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
            </>
          )}
        </div>

        {canReply && isReplying && (
          <CommentEditor
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
              onSetReplyingCommentId(null);
            }}
            onCancel={() => onSetReplyingCommentId(null)}
            boardMembers={boardMembers}
          />
        )}
      </div>
    </div>
  );
};
