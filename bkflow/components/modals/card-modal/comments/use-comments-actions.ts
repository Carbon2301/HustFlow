"use client";

import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { createCardComment } from "@/actions/cards/create-card-comment";
import { deleteCardComment } from "@/actions/cards/delete-card-comment";
import { toggleCardCommentReaction } from "@/actions/cards/toggle-card-comment-reaction";
import { updateCardComment } from "@/actions/cards/update-card-comment";
import { useAction } from "@/hooks/use-action";
import type { CardCommentWithReplies } from "@/types";

import { patchBoardCardCount } from "../card-cache-utils";
import type { ReactionEmoji } from "./comment-utils";

export const useCommentsActions = ({
  cardId,
  boardId,
  items,
  onEditComplete,
}: {
  cardId: string;
  boardId?: string;
  items: CardCommentWithReplies[];
  onEditComplete: () => void;
}) => {
  const queryClient = useQueryClient();

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
        onEditComplete();
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

  const onToggleReaction = (commentId: string, emoji: ReactionEmoji) => {
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

  return {
    isCreating,
    isUpdating,
    isDeleting,
    isReacting,
    onCreateComment,
    onUpdateComment,
    onDeleteComment,
    onToggleReaction,
  };
};
