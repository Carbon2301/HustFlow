"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { createCardDependency } from "@/actions/dependencies/create-card-dependency";
import { deleteCardDependency } from "@/actions/dependencies/delete-card-dependency";
import { useAction } from "@/hooks/use-action";

import type { DependencyListItem } from "./dependency-utils";

export const useDependencyActions = ({
  boardId,
  cardId,
}: {
  boardId: string;
  cardId: string;
}) => {
  const queryClient = useQueryClient();
  const [deletingDependencyId, setDeletingDependencyId] = useState<string | null>(null);

  const invalidateDependencyCards = (dependency: {
    blockerCardId: string;
    blockedCardId: string;
  }) => {
    queryClient.invalidateQueries({ queryKey: ["card", cardId] });
    queryClient.invalidateQueries({ queryKey: ["card-logs", cardId] });
    queryClient.invalidateQueries({ queryKey: ["card", dependency.blockerCardId] });
    queryClient.invalidateQueries({ queryKey: ["card", dependency.blockedCardId] });
  };

  const { execute: executeCreateDependency, isLoading: isCreating } = useAction(createCardDependency, {
    onSuccess: (dependency) => {
      toast.success("Đã thêm liên kết phụ thuộc.");
      invalidateDependencyCards(dependency);
    },
    onError: (error) => toast.error(error),
  });

  const { execute: executeDeleteDependency } = useAction(deleteCardDependency, {
    onSuccess: (dependency) => {
      toast.success("Đã gỡ liên kết phụ thuộc.");
      invalidateDependencyCards(dependency);
    },
    onError: (error) => toast.error(error),
    onComplete: () => setDeletingDependencyId(null),
  });

  const onCreateDependency = ({
    blockerCardId,
    blockedCardId,
  }: {
    blockerCardId: string;
    blockedCardId: string;
  }) => {
    executeCreateDependency({
      boardId,
      blockerCardId,
      blockedCardId,
    });
  };

  const onDeleteDependency = (item: DependencyListItem) => {
    setDeletingDependencyId(item.dependency.id);
    executeDeleteDependency({
      boardId,
      dependencyId: item.dependency.id,
    });
  };

  return {
    deletingDependencyId,
    isCreating,
    onCreateDependency,
    onDeleteDependency,
  };
};
