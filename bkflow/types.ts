import { BoardMember, Card, List, Prisma, Label, CardLabel } from "@prisma/client";

export type CardWithAssignees = Card & {
  assignees: Prisma.CardAssigneeGetPayload<{
    include: {
      boardMember: true;
    };
  }>[];
  labels: (CardLabel & {
    label: Label;
  })[];
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
  boardMembers: BoardMember[];
  boardLabels: Label[];
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
