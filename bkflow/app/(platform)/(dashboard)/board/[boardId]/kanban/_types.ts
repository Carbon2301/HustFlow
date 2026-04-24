import type { BoardMember, BoardMemberRole } from "@prisma/client";

import type { CardWithAssignees, ListWithCards } from "@/types";

export type ListContainerProps = {
  data: ListWithCards[];
  boardId: string;
  boardMembers: BoardMember[];
  currentUserId: string;
  currentMemberRole: BoardMemberRole;
  enableCalendarDragHandle?: boolean;
};

export type CardContextMenuPosition = {
  top: number;
  left: number;
};

export type CardContextMenuProps = {
  isOpen: boolean;
  canEdit: boolean;
  position: CardContextMenuPosition;
  isLoadingArchive: boolean;
  onClose: () => void;
  onOpen: (event?: React.MouseEvent) => void;
  onRename: (event: React.MouseEvent) => void;
  onCopy: (event: React.MouseEvent) => void;
  onArchive: (event: React.MouseEvent) => void;
};

export type CardBadgesProps = {
  card: CardWithAssignees;
};
