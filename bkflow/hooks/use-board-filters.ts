"use client";

import { create } from "zustand";

export type BoardFilterState = {
  selectedMemberIds: string[];
  myWorkEnabled: boolean;
  noMembersEnabled: boolean;
  completedEnabled: boolean;
  notCompletedEnabled: boolean;
  selectedDueDateFilters: string[]; // "no-due" | "overdue" | "next-hour" | "tomorrow" | "next-week" | "next-month"
};

type BoardFiltersStore = {
  filtersByBoardId: Record<string, BoardFilterState | undefined>;
  toggleMyWork: (boardId: string) => void;
  toggleNoMembers: (boardId: string) => void;
  toggleCompleted: (boardId: string) => void;
  toggleNotCompleted: (boardId: string) => void;
  toggleMember: (boardId: string, memberId: string) => void;
  toggleDueDateFilter: (boardId: string, filterType: string) => void;
  clearFilters: (boardId: string) => void;
};

export const emptyBoardFilters: BoardFilterState = {
  selectedMemberIds: [],
  myWorkEnabled: false,
  noMembersEnabled: false,
  completedEnabled: false,
  notCompletedEnabled: false,
  selectedDueDateFilters: [],
};

const getBoardFilters = (
  filtersByBoardId: BoardFiltersStore["filtersByBoardId"],
  boardId: string,
) => filtersByBoardId[boardId] ?? emptyBoardFilters;

export const useBoardFilters = create<BoardFiltersStore>((set) => ({
  filtersByBoardId: {},
  toggleMyWork: (boardId) =>
    set((state) => {
      const currentFilters = getBoardFilters(state.filtersByBoardId, boardId);
      return {
        filtersByBoardId: {
          ...state.filtersByBoardId,
          [boardId]: {
            ...currentFilters,
            myWorkEnabled: !currentFilters.myWorkEnabled,
          },
        },
      };
    }),
  toggleNoMembers: (boardId) =>
    set((state) => {
      const currentFilters = getBoardFilters(state.filtersByBoardId, boardId);
      return {
        filtersByBoardId: {
          ...state.filtersByBoardId,
          [boardId]: {
            ...currentFilters,
            noMembersEnabled: !currentFilters.noMembersEnabled,
          },
        },
      };
    }),
  toggleCompleted: (boardId) =>
    set((state) => {
      const currentFilters = getBoardFilters(state.filtersByBoardId, boardId);
      const nextCompleted = !currentFilters.completedEnabled;
      return {
        filtersByBoardId: {
          ...state.filtersByBoardId,
          [boardId]: {
            ...currentFilters,
            completedEnabled: nextCompleted,
            notCompletedEnabled: nextCompleted ? false : currentFilters.notCompletedEnabled,
          },
        },
      };
    }),
  toggleNotCompleted: (boardId) =>
    set((state) => {
      const currentFilters = getBoardFilters(state.filtersByBoardId, boardId);
      const nextNotCompleted = !currentFilters.notCompletedEnabled;
      return {
        filtersByBoardId: {
          ...state.filtersByBoardId,
          [boardId]: {
            ...currentFilters,
            notCompletedEnabled: nextNotCompleted,
            completedEnabled: nextNotCompleted ? false : currentFilters.completedEnabled,
          },
        },
      };
    }),
  toggleMember: (boardId, memberId) =>
    set((state) => {
      const currentFilters = getBoardFilters(state.filtersByBoardId, boardId);
      const selectedMemberIds = currentFilters.selectedMemberIds.includes(memberId)
        ? currentFilters.selectedMemberIds.filter((id) => id !== memberId)
        : [...currentFilters.selectedMemberIds, memberId];

      return {
        filtersByBoardId: {
          ...state.filtersByBoardId,
          [boardId]: {
            ...currentFilters,
            selectedMemberIds,
          },
        },
      };
    }),
  toggleDueDateFilter: (boardId, filterType) =>
    set((state) => {
      const currentFilters = getBoardFilters(state.filtersByBoardId, boardId);
      const selectedDueDateFilters = currentFilters.selectedDueDateFilters.includes(filterType)
        ? currentFilters.selectedDueDateFilters.filter((type) => type !== filterType)
        : [...currentFilters.selectedDueDateFilters, filterType];

      return {
        filtersByBoardId: {
          ...state.filtersByBoardId,
          [boardId]: {
            ...currentFilters,
            selectedDueDateFilters,
          },
        },
      };
    }),
  clearFilters: (boardId) =>
    set((state) => ({
      filtersByBoardId: {
        ...state.filtersByBoardId,
        [boardId]: emptyBoardFilters,
      },
    })),
}));
