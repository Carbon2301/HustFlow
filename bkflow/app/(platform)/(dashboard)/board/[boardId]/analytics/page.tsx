import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { getBoardAnalyticsData } from "@/lib/analytics/board-report-data";
import { requireBoardMemberForUser } from "@/lib/permissions";

import { BoardAnalyticsView } from "./_components/board-analytics-view";

interface BoardAnalyticsPageProps {
  params: Promise<{
    boardId: string;
  }>;
}

const BoardAnalyticsPage = async ({
  params,
}: BoardAnalyticsPageProps) => {
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

  const analytics = await getBoardAnalyticsData({
    boardId,
    orgId: currentMembership.membership.board.orgId,
  });

  return (
    <BoardAnalyticsView
      boardId={boardId}
      kpis={analytics.kpis}
      listDistribution={analytics.listDistribution}
      workload={analytics.workload}
      scheduleHealth={analytics.scheduleHealth}
      insights={analytics.insights}
    />
  );
};

export default BoardAnalyticsPage;
