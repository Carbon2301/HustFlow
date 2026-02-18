import type { QueryClient } from "@tanstack/react-query";

import type { CardWithAssignees, CardWithList } from "@/types";
import { useBoardStateActionsStore } from "@/hooks/use-board-state-actions-store";

export const patchCardQueryData = (
  queryClient: QueryClient,
  cardId: string,
  patch: Partial<CardWithList>,
) => {
  queryClient.setQueryData<CardWithList>(["card", cardId], (current) => {
    if (!current) {
      return current;
    }

    return {
      ...current,
      ...patch,
    };
  });
};

export const patchBoardCardPreview = (
  boardId: string,
  cardId: string,
  patch: Partial<CardWithAssignees>,
) => {
  useBoardStateActionsStore.getState().getBoardActions(boardId)?.patchCard(cardId, patch);
};

export const patchBoardCardCount = (
  boardId: string,
  cardId: string,
  countKey: "comments" | "attachments",
  delta: number,
) => {
  useBoardStateActionsStore.getState().getBoardActions(boardId)?.patchCardCount(
    cardId,
    countKey,
    delta,
  );
};
