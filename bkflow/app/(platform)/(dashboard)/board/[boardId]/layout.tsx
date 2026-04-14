import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";

import { getBoardSwitcherData } from "@/lib/board-switcher";
import { getOrganizationMembers } from "@/lib/clerk-org-members";
import { db } from "@/lib/db";
import { requireBoardMemberForUser } from "@/lib/permissions";

import { BoardOrgControl } from "./_components/board-org-control";
import { BoardNavbar } from "./_components/board-navbar";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ boardId: string }>;
}) {
  const { boardId } = await params;
  const { userId } = await auth();

  if (!userId) {
    return {
      title: "Bảng",
    };
  }

  const [currentMembership, board] = await Promise.all([
    requireBoardMemberForUser({ boardId, userId }),
    db.board.findUnique({
      where: {
        id: boardId,
      },
      select: {
        title: true,
      },
    }),
  ]);

  if (currentMembership.error) {
    return {
      title: "Bảng",
    };
  }

  return {
    title: board?.title || "Bảng",
  };
}

const BoardIdLayout = async ({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ boardId: string }>;
}) => {
  const { boardId } = await params;
  const { orgId, userId } = await auth();

  if (!userId) {
    redirect("/select-org");
  }

  const currentMembership = await requireBoardMemberForUser({ boardId, userId });

  if (currentMembership.error || !currentMembership.membership) {
    const errorMessage = currentMembership.error || "Bạn không có quyền truy cập bảng này.";
    redirect(`/organization/${orgId ?? ""}?error=${encodeURIComponent(errorMessage)}`);
  }

  const boardOrgId = currentMembership.membership.board.orgId;

  const [board, organizationMembers, boardSwitcherData] = await Promise.all([
    db.board.findUnique({
      where: {
        id: boardId,
      },
      include: {
        members: {
          orderBy: {
            createdAt: "asc",
          },
        },
        labels: {
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    }),
    getOrganizationMembers(boardOrgId),
    getBoardSwitcherData(userId),
  ]);

  if (!board) {
    notFound();
  }

  return (
    <div
      className="relative h-screen flex flex-col overflow-hidden bg-no-repeat bg-cover bg-center"
      style={{ backgroundImage: `url(${board.imageFullUrl})` }}
    >
      <BoardOrgControl orgId={boardOrgId} />
      <BoardNavbar
        data={board}
        organizationMembers={organizationMembers}
        boardSwitcherData={boardSwitcherData}
        currentUserId={userId}
        currentMemberRole={currentMembership.membership.role}
      />
      <div className="absolute inset-0 bg-black/10" />
      <main className="relative pt-28 flex-1 min-h-0 overflow-hidden">
        {children}
      </main>
    </div>
  );
};

export default BoardIdLayout;
