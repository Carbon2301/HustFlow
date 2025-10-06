import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";

import { db } from "@/lib/db";
import { getOrganizationMembers } from "@/lib/clerk-org-members";
import { requireBoardMember } from "@/lib/permissions";

import { BoardNavbar } from "./_components/board-navbar";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ boardId: string }>;
}) {
  const { boardId } = await params;
  const { orgId, userId } = await auth();

  if (!orgId || !userId) {
    return {
      title: "Bảng",
    };
  }

  const currentMembership = await requireBoardMember({ boardId, orgId, userId });

  if (currentMembership.error) {
    return {
      title: "Bảng",
    };
  }

  const board = await db.board.findUnique({
    where: {
      id: boardId,
      orgId,
    },
  });

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

  if (!orgId || !userId) {
    redirect("/select-org");
  }

  const currentMembership = await requireBoardMember({ boardId, orgId, userId });

  if (currentMembership.error || !currentMembership.membership) {
    const errorMessage = currentMembership.error || "Bạn không có quyền truy cập bảng này.";
    redirect(`/organization/${orgId}?error=${encodeURIComponent(errorMessage)}`);
  }

  const board = await db.board.findUnique({
    where: {
      id: boardId,
      orgId,
    },
    include: {
      members: {
        orderBy: {
          createdAt: "asc",
        },
      },
    },
  });

  if (!board) {
    notFound();
  }

  const organizationMembers = await getOrganizationMembers(orgId);

  return (
    <div
      className="relative h-screen flex flex-col overflow-hidden bg-no-repeat bg-cover bg-center"
      style={{ backgroundImage: `url(${board.imageFullUrl})` }}
    >
      <BoardNavbar
        data={board}
        organizationMembers={organizationMembers}
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
