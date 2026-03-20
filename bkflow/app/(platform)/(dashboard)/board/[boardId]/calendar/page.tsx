import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { requireBoardMemberForUser } from "@/lib/permissions";

import { BoardCalendarView } from "./_components/board-calendar-view";

interface BoardCalendarPageProps {
  params: Promise<{
    boardId: string;
  }>;
}

const BoardCalendarPage = async ({
  params,
}: BoardCalendarPageProps) => {
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

  const lists = await db.list.findMany({
    where: {
      boardId,
      archivedAt: null,
      board: {
        orgId: boardOrgId,
      },
    },
    select: {
      id: true,
      title: true,
      order: true,
    },
    orderBy: {
      order: "asc",
    },
  });

  return (
    <div className="h-full p-4">
      <BoardCalendarView
        boardId={boardId}
        lists={lists}
        currentUserId={userId}
        currentBoardMemberId={currentMembership.membership.id}
      />
    </div>
  );
};

export default BoardCalendarPage;
