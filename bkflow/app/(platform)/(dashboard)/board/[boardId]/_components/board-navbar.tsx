import { Board, BoardMember, BoardMemberRole, Label } from "@prisma/client";

import { BoardTitleForm } from "./board-title-form";
import { BoardOptions } from "./board-options";
import { BoardMembers } from "./board-members";
import { BoardFilters } from "./board-filters";
import { BoardViewSwitcher } from "./board-view-switcher";
import { ClerkOrgMember } from "@/lib/clerk-org-members";

interface BoardNavbarProps {
  data: Board & { members: BoardMember[]; labels: Label[] };
  organizationMembers: ClerkOrgMember[];
  currentUserId: string;
  currentMemberRole: BoardMemberRole;
};

export const BoardNavbar = async ({
  data,
  organizationMembers,
  currentUserId,
  currentMemberRole,
}: BoardNavbarProps) => {
  const isAdmin = currentMemberRole === BoardMemberRole.ADMIN;

  return (
    <div className="fixed top-14 z-[40] flex h-14 w-full items-center justify-between bg-gradient-to-b from-black/50 to-black/30 px-3 text-white backdrop-blur-sm md:px-6">
      <div className="flex min-w-0 flex-1 items-center pr-2">
        <BoardTitleForm data={data} canEdit={isAdmin} currentUserId={currentUserId} />
      </div>
      <div className="flex shrink-0 items-center justify-end gap-x-1.5 md:gap-x-2">
        <BoardViewSwitcher boardId={data.id} />
        <BoardFilters
          boardId={data.id}
          members={data.members}
          currentUserId={currentUserId}
          labels={data.labels}
        />
        <BoardMembers
          boardId={data.id}
          members={data.members}
          organizationMembers={organizationMembers}
          currentUserId={currentUserId}
          canManage={isAdmin}
        />
        {isAdmin && <BoardOptions id={data.id} />}
      </div>
    </div>
  );
};
