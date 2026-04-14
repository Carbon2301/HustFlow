export type BoardCalendarCardItem = {
  type: "card";
  id: string;
  cardId: string;
  boardId: string;
  listId: string;
  listTitle: string;
  title: string;
  startDate: string | null;
  dueDate: string | null;
  isCompleted: boolean;
  reminder: string | null;
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
};

export type BoardCalendarChecklistItem = {
  type: "checklist-item";
  id: string;
  checklistItemId: string;
  checklistId: string;
  checklistTitle: string;
  cardId: string;
  cardTitle: string;
  boardId: string;
  listId: string;
  listTitle: string;
  title: string;
  dueDate: string;
  isCompleted: boolean;
  assignee: {
    id: string;
    boardMemberId: string;
    userId: string;
    userName: string;
    userImage: string;
  } | null;
  labels: {
    id: string;
    title: string;
    color: string;
  }[];
};

export type BoardCalendarItem =
  | BoardCalendarCardItem
  | BoardCalendarChecklistItem;

export type BoardCalendarUnscheduledCard = {
  type: "unscheduled-card";
  id: string;
  cardId: string;
  boardId: string;
  listId: string;
  listTitle: string;
  title: string;
  isCompleted: boolean;
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
  order: number;
  listOrder: number;
};

export type BoardCalendarResponse = {
  boardId: string;
  from: string;
  to: string;
  items: BoardCalendarItem[];
  unscheduledCards: BoardCalendarUnscheduledCard[];
};
