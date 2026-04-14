import type { Card, CardLabel, Label, List, Prisma } from "@prisma/client";

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
