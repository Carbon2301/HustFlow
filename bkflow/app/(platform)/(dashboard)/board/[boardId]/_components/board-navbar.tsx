import { Board, BoardMember } from "@prisma/client";

import { BoardTitleForm } from "./board-title-form";
import { BoardOptions } from "./board-options";
import { BoardMembers } from "./board-members";
import { BoardFilters } from "./board-filters";
import { ClerkOrgMember } from "@/lib/clerk-org-members";

interface BoardNavbarProps {
  data: Board & { members: BoardMember[] };
  organizationMembers: ClerkOrgMember[];
  currentUserId: string;
};

export const BoardNavbar = async ({
  data,
  organizationMembers,
  currentUserId,
}: BoardNavbarProps) => {
  return (
    <div className="w-full h-14 z-[40] bg-gradient-to-b from-black/50 to-black/30 fixed top-14 flex items-center px-4 md:px-6 gap-x-4 text-white backdrop-blur-sm">
      <BoardTitleForm data={data} />
      <div className="ml-auto flex items-center gap-x-2">
        <BoardFilters
          boardId={data.id}
          members={data.members}
          currentUserId={currentUserId}
        />
        <BoardMembers
          boardId={data.id}
          members={data.members}
          organizationMembers={organizationMembers}
        />
        <BoardOptions id={data.id} />
      </div>
    </div>
  );
};
