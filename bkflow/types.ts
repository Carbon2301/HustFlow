import { BoardMember, Card, CardAttachment, List, Prisma, Label, CardLabel, Checklist, ChecklistItem } from "@prisma/client";

export type ChecklistItemWithAssignee = ChecklistItem & {
  assignee: BoardMember | null;
};

export type CardWithAssignees = Card & {
  assignees: Prisma.CardAssigneeGetPayload<{
    include: {
      boardMember: true;
    };
  }>[];
  labels: (CardLabel & {
    label: Label;
  })[];
  checklists?: {
    items: { isCompleted: boolean }[];
  }[];
  _count?: {
    comments: number;
  };
};

export type ListWithCards = List & { cards: CardWithAssignees[] };

export type CardWithList = Card & {
  list: List;
  attachments: CardAttachment[];
  assignees: Prisma.CardAssigneeGetPayload<{
    include: {
      boardMember: true;
    };
  }>[];
  labels: (CardLabel & {
    label: Label;
  })[];
  checklists: (Checklist & {
    items: ChecklistItemWithAssignee[];
  })[];
  boardMembers: BoardMember[];
  boardLabels: Label[];
  boardChecklists: (Checklist & {
    items: ChecklistItemWithAssignee[];
    card: {
      title: string;
    };
  })[];
};

export type CardCommentWithReplies = Prisma.CardCommentGetPayload<{
  include: {
    reactions: true;
    replies: {
      include: {
        reactions: true;
      };
    };
  };
}>;

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
};

export type BoardCalendarItem = BoardCalendarCardItem | BoardCalendarChecklistItem;

export type BoardCalendarResponse = {
  boardId: string;
  from: string;
  to: string;
  items: BoardCalendarItem[];
};
