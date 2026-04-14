import type { BoardMemberRole } from "@prisma/client";

export type BoardTimelineBoardMember = {
  id: string;
  userId: string;
  userName: string;
  userImage: string;
  userEmail: string | null;
  role: BoardMemberRole;
};

export type BoardTimelineDependency = {
  id: string;
  cardId: string;
  title: string;
  listId: string;
  listTitle: string;
  isCompleted: boolean;
  startDate: string | null;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BoardTimelineCard = {
  id: string;
  title: string;
  order: number;
  listId: string;
  listTitle: string;
  listOrder: number;
  isCompleted: boolean;
  startDate: string | null;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  labels: {
    id: string;
    title: string;
    color: string;
  }[];
  assignees: {
    id: string;
    boardMemberId: string;
    userId: string;
    userName: string;
    userImage: string;
  }[];
  commentCount: number;
  attachmentCount: number;
  checklistProgress: {
    total: number;
    completed: number;
  };
  blockedByDependencies: BoardTimelineDependency[];
  blockingDependencies: BoardTimelineDependency[];
  unresolvedBlockerCount: number;
};

export type BoardTimelineList = {
  id: string;
  title: string;
  order: number;
  createdAt: string;
  updatedAt: string;
  cards: BoardTimelineCard[];
};
