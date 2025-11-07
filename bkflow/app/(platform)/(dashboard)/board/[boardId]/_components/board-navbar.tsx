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
    <div className="w-full h-14 z-[40] bg-gradient-to-b from-black/50 to-black/30 fixed top-14 flex items-center px-4 md:px-6 gap-x-4 text-white backdrop-blur-sm">
      <BoardTitleForm data={data} canEdit={isAdmin} currentUserId={currentUserId} />
      <div className="ml-auto flex items-center gap-x-2">
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
