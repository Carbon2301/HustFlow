import { BoardMember, Card, List, Prisma, Label, CardLabel, Checklist, ChecklistItem } from "@prisma/client";

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
