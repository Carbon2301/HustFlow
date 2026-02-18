import { create } from "zustand";

import type { CardWithAssignees } from "@/types";

type BoardPatchActions = {
  patchCard: (cardId: string, patch: Partial<CardWithAssignees>) => void;
  patchCardCount: (
    cardId: string,
    countKey: "comments" | "attachments",
    delta: number,
  ) => void;
};

type BoardStateActionsStore = {
  actionsByBoardId: Record<string, BoardPatchActions | undefined>;
  registerBoardActions: (boardId: string, actions: BoardPatchActions) => void;
  unregisterBoardActions: (boardId: string) => void;
  getBoardActions: (boardId: string) => BoardPatchActions | undefined;
};

export const useBoardStateActionsStore = create<BoardStateActionsStore>((set, get) => ({
  actionsByBoardId: {},
  registerBoardActions: (boardId, actions) =>
    set((state) => ({
      actionsByBoardId: {
        ...state.actionsByBoardId,
        [boardId]: actions,
      },
    })),
  unregisterBoardActions: (boardId) =>
    set((state) => {
      const next = { ...state.actionsByBoardId };

      delete next[boardId];

      return {
        actionsByBoardId: next,
      };
    }),
  getBoardActions: (boardId) => get().actionsByBoardId[boardId],
}));
