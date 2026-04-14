import type {
  BoardMember,
  BoardMemberRole,
  Card,
  CardAttachment,
  CardLabel,
  Checklist,
  ChecklistItem,
  Label,
  List,
  Prisma,
} from "@prisma/client";

export type ChecklistItemWithAssignee = ChecklistItem & {
  assignee: BoardMember | null;
};

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
