import type { BoardMember, Checklist } from "@prisma/client";

import type {
  CardCommentWithReplies,
  CardWithList,
  ChecklistItemWithAssignee,
} from "@/types";

export type CardModalCanEditProps = {
  canEdit?: boolean;
};

export type CardModalSectionProps = CardModalCanEditProps & {
  data: CardWithList;
};

export type CardModalBoardMember = BoardMember;

export type CommentEditorMode = "create" | "edit" | "reply";

export type CommentDraft = {
  content: string;
  parentId?: string | null;
};

export type CardModalCommentItem =
  | CardCommentWithReplies
  | CardCommentWithReplies["replies"][number];

export type ChecklistWithItems = Checklist & {
  items: ChecklistItemWithAssignee[];
};

export type DependencyMode = "blocked-by" | "blocking";
