import { BoardMember, BoardMemberRole, Card, CardAttachment, List, Prisma, Label, CardLabel, Checklist, ChecklistItem } from "@prisma/client";

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
  checklistProgress?: {
    total: number;
    completed: number;
  };
  unresolvedBlockerCount?: number;
  _count?: {
    comments: number;
    attachments: number;
  };
};

export type ListWithCards = List & { cards: CardWithAssignees[] };

export type CardDependencyWithBlockerCard = Prisma.CardDependencyGetPayload<{
  include: {
    blockerCard: {
      select: {
        id: true;
        title: true;
        isCompleted: true;
        archivedAt: true;
      };
    };
  };
}>;

export type CardDependencyWithBlockedCard = Prisma.CardDependencyGetPayload<{
  include: {
    blockedCard: {
      select: {
        id: true;
        title: true;
        isCompleted: true;
        archivedAt: true;
      };
    };
  };
}>;

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
  blockedByDependencies: CardDependencyWithBlockerCard[];
  blockingDependencies: CardDependencyWithBlockedCard[];
  boardMembers: BoardMember[];
  currentMemberRole?: BoardMemberRole;
  boardLabels: Label[];
  boardChecklists: (Checklist & {
    items: ChecklistItemWithAssignee[];
    card: {
      title: string;
    };
  })[];
  _count?: {
    comments: number;
    attachments: number;
  };
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
  labels: {
    id: string;
    title: string;
    color: string;
  }[];
};

export type BoardCalendarItem = BoardCalendarCardItem | BoardCalendarChecklistItem;

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

export type BoardSearchResult = (
  {
      type: "card";
      id: string;
      cardId: string;
      cardTitle: string;
      listId: string;
      listTitle: string;
      title: string;
      snippet: string | null;
    }
  | {
      type: "description";
      id: string;
      cardId: string;
      cardTitle: string;
      listId: string;
      listTitle: string;
      title: string;
      snippet: string;
    }
  | {
      type: "checklist";
      id: string;
      checklistId: string;
      cardId: string;
      cardTitle: string;
      listId: string;
      listTitle: string;
      title: string;
      snippet: string | null;
    }
  | {
      type: "checklist-item";
      id: string;
      checklistItemId: string;
      checklistTitle: string;
      cardId: string;
      cardTitle: string;
      listId: string;
      listTitle: string;
      title: string;
      snippet: string | null;
    }
  | {
      type: "comment";
      id: string;
      commentId: string;
      cardId: string;
      cardTitle: string;
      listId: string;
      listTitle: string;
      title: string;
      snippet: string | null;
      userName?: string;
    }
  | {
      type: "attachment";
      id: string;
      attachmentId: string;
      cardId: string;
      cardTitle: string;
      listId: string;
      listTitle: string;
      title: string;
      snippet: string | null;
      attachmentType: "LINK" | "FILE";
    }
) & {
  isArchived: boolean;
};

export type BoardSearchResponse = {
  items: BoardSearchResult[];
};
