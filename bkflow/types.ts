import { BoardMember, Card, List, Prisma } from "@prisma/client";

export type CardWithAssignees = Card & {
  assignees: Prisma.CardAssigneeGetPayload<{
    include: {
      boardMember: true;
    };
  }>[];
};

export type ListWithCards = List & { cards: CardWithAssignees[] };

export type CardWithList = Card & {
  list: List;
  assignees: Prisma.CardAssigneeGetPayload<{
    include: {
      boardMember: true;
    };
  }>[];
  boardMembers: BoardMember[];
};
