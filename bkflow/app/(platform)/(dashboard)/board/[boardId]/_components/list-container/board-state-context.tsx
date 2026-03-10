"use client";

import {
  createContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";

import type { CardWithAssignees, ListWithCards } from "@/types";
import { useBoardStateActionsStore } from "@/hooks/use-board-state-actions-store";

export type BoardStateActions = {
  getSnapshot: () => ListWithCards[];
  resetToSnapshot: (snapshot: ListWithCards[]) => void;
  setLists: Dispatch<SetStateAction<ListWithCards[]>>;
  appendList: (list: ListWithCards) => void;
  replaceList: (temporaryId: string, list: ListWithCards) => void;
  removeList: (listId: string) => void;
  patchList: (listId: string, patch: Partial<ListWithCards>) => void;
  appendCard: (listId: string, card: CardWithAssignees) => void;
  replaceCard: (temporaryId: string, card: CardWithAssignees) => void;
  removeCard: (cardId: string) => void;
  removeCardsInList: (listId: string) => void;
  patchCard: (cardId: string, patch: Partial<CardWithAssignees>) => void;
  moveCardToList: (
    cardId: string,
    destinationListId: string,
    destinationIndex?: number,
  ) => void;
};

type BoardStateProviderProps = {
  children: ReactNode;
  boardId: string;
  data: ListWithCards[];
  setData: Dispatch<SetStateAction<ListWithCards[]>>;
};

const BoardStateContext = createContext<BoardStateActions | null>(null);

const cloneBoardState = (data: ListWithCards[]) => {
  if (typeof structuredClone === "function") {
    return structuredClone(data);
  }

  return data.map((list) => ({
    ...list,
    cards: list.cards.map((card) => ({
      ...card,
      assignees: card.assignees.map((assignee) => ({
        ...assignee,
        boardMember: { ...assignee.boardMember },
      })),
      labels: card.labels.map((cardLabel) => ({
        ...cardLabel,
        label: { ...cardLabel.label },
      })),
      checklists: card.checklists?.map((checklist) => ({
        ...checklist,
        items: checklist.items.map((item) => ({ ...item })),
      })),
      checklistProgress: card.checklistProgress ? { ...card.checklistProgress } : undefined,
      _count: card._count ? { ...card._count } : undefined,
    })),
  }));
};

const recalculateCardOrder = (cards: CardWithAssignees[]) =>
  cards.map((card, index) => ({
    ...card,
    order: index,
  }));

export const BoardStateProvider = ({
  children,
  boardId,
  data,
  setData,
}: BoardStateProviderProps) => {
  const registerBoardActions = useBoardStateActionsStore((state) => state.registerBoardActions);
  const unregisterBoardActions = useBoardStateActionsStore((state) => state.unregisterBoardActions);
  const dataRef = useRef(data);

  useLayoutEffect(() => {
    dataRef.current = data;
  }, [data]);

  const getSnapshot = useCallback(() => cloneBoardState(dataRef.current), []);

  const resetToSnapshot = useCallback((snapshot: ListWithCards[]) => {
    setData(cloneBoardState(snapshot));
  }, [setData]);

  const appendList = useCallback((list: ListWithCards) => {
    setData((current) => [...current, list]);
  }, [setData]);

  const replaceList = useCallback((temporaryId: string, list: ListWithCards) => {
    setData((current) =>
      current.map((item) => item.id === temporaryId ? list : item),
    );
  }, [setData]);

  const removeList = useCallback((listId: string) => {
    setData((current) => current.filter((list) => list.id !== listId));
  }, [setData]);

  const patchList = useCallback((listId: string, patch: Partial<ListWithCards>) => {
    setData((current) =>
      current.map((list) =>
        list.id === listId
          ? {
              ...list,
              ...patch,
            }
          : list,
      ),
    );
  }, [setData]);

  const appendCard = useCallback((listId: string, card: CardWithAssignees) => {
    setData((current) =>
      current.map((list) =>
        list.id === listId
          ? {
              ...list,
              cards: [...list.cards, card],
            }
          : list,
      ),
    );
  }, [setData]);

  const replaceCard = useCallback((temporaryId: string, card: CardWithAssignees) => {
    setData((current) =>
      current.map((list) => {
        const cardIndex = list.cards.findIndex((item) => item.id === temporaryId);

        if (cardIndex === -1) {
          return list;
        }

        const cards = [...list.cards];
        cards[cardIndex] = card;

        return {
          ...list,
          cards,
        };
      }),
    );
  }, [setData]);

  const removeCard = useCallback((cardId: string) => {
    setData((current) =>
      current.map((list) => {
        if (!list.cards.some((card) => card.id === cardId)) {
          return list;
        }

        return {
          ...list,
          cards: list.cards.filter((card) => card.id !== cardId),
        };
      }),
    );
  }, [setData]);

  const removeCardsInList = useCallback((listId: string) => {
    setData((current) =>
      current.map((list) =>
        list.id === listId
          ? {
              ...list,
              cards: [],
            }
          : list,
      ),
    );
  }, [setData]);

  const patchCard = useCallback((cardId: string, patch: Partial<CardWithAssignees>) => {
    setData((current) =>
      current.map((list) => {
        const cardIndex = list.cards.findIndex((card) => card.id === cardId);

        if (cardIndex === -1) {
          return list;
        }

        const cards = [...list.cards];
        cards[cardIndex] = {
          ...cards[cardIndex],
          ...patch,
        };

        return {
          ...list,
          cards,
        };
      }),
    );
  }, [setData]);

  const patchCardCount = useCallback((
    cardId: string,
    countKey: "comments" | "attachments",
    delta: number,
  ) => {
    setData((current) =>
      current.map((list) => {
        const cardIndex = list.cards.findIndex((card) => card.id === cardId);

        if (cardIndex === -1) {
          return list;
        }

        const card = list.cards[cardIndex];
        const currentCount = card._count ?? {
          comments: 0,
          attachments: 0,
        };
        const cards = [...list.cards];

        cards[cardIndex] = {
          ...card,
          _count: {
            ...currentCount,
            [countKey]: Math.max((currentCount[countKey] ?? 0) + delta, 0),
          },
        };

        return {
          ...list,
          cards,
        };
      }),
    );
  }, [setData]);

  const moveCardToList = useCallback((
    cardId: string,
    destinationListId: string,
    destinationIndex?: number,
  ) => {
    setData((current) => {
      const destinationList = current.find((list) => list.id === destinationListId);
      const sourceList = current.find((list) =>
        list.cards.some((card) => card.id === cardId),
      );
      const card = sourceList?.cards.find((item) => item.id === cardId);

      if (!destinationList || !sourceList || !card) {
        return current;
      }

      const nextLists = current.map((list) => {
        if (list.id !== sourceList.id && list.id !== destinationListId) {
          return list;
        }

        const cardsWithoutMovedCard = list.cards.filter((item) => item.id !== cardId);

        if (list.id !== destinationListId) {
          return {
            ...list,
            cards: recalculateCardOrder(cardsWithoutMovedCard),
          };
        }

        const safeIndex = destinationIndex === undefined
          ? cardsWithoutMovedCard.length
          : Math.min(Math.max(destinationIndex, 0), cardsWithoutMovedCard.length);
        const movedCard = {
          ...card,
          listId: destinationListId,
        };
        const nextCards = [...cardsWithoutMovedCard];

        nextCards.splice(safeIndex, 0, movedCard);

        return {
          ...list,
          cards: recalculateCardOrder(nextCards),
        };
      });

      return nextLists;
    });
  }, [setData]);

  useEffect(() => {
    registerBoardActions(boardId, {
      patchCard,
      patchCardCount,
    });

    return () => {
      unregisterBoardActions(boardId);
    };
  }, [boardId, patchCard, patchCardCount, registerBoardActions, unregisterBoardActions]);

  const value = useMemo<BoardStateActions>(() => ({
    getSnapshot,
    resetToSnapshot,
    setLists: setData,
    appendList,
    replaceList,
    removeList,
    patchList,
    appendCard,
    replaceCard,
    removeCard,
    removeCardsInList,
    patchCard,
    moveCardToList,
  }), [
    getSnapshot,
    resetToSnapshot,
    setData,
    appendList,
    replaceList,
    removeList,
    patchList,
    appendCard,
    replaceCard,
    removeCard,
    removeCardsInList,
    patchCard,
    moveCardToList,
  ]);

  return (
    <BoardStateContext.Provider value={value}>
      {children}
    </BoardStateContext.Provider>
  );
};

export const useBoardState = () => {
  const context = useContext(BoardStateContext);

  if (!context) {
    throw new Error("useBoardState must be used within BoardStateProvider");
  }

  return context;
};
