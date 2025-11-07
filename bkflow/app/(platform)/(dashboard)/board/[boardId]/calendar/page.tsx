import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { requireBoardMember } from "@/lib/permissions";

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

  if (!orgId || !userId) {
    redirect("/select-org");
  }

  const currentMembership = await requireBoardMember({ boardId, orgId, userId });

  if (currentMembership.error || !currentMembership.membership) {
    const errorMessage = currentMembership.error || "Bạn không có quyền truy cập bảng này.";
    redirect(`/organization/${orgId}?error=${encodeURIComponent(errorMessage)}`);
  }

  return (
    <div className="h-full p-4">
      <BoardCalendarView boardId={boardId} />
    </div>
  );
};

export default BoardCalendarPage;
