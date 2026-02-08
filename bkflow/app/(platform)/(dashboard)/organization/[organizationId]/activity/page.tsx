import { Suspense } from "react";

import { ActivityList } from "./_components/activity-list";

interface ActivityPageProps {
  searchParams: Promise<{
    page?: string;
    boardId?: string;
    eventType?: string;
    userId?: string;
    range?: string;
    from?: string;
    to?: string;
    q?: string;
  }>;
}

const ActivityPage = async ({ searchParams }: ActivityPageProps) => {
  const resolvedSearchParams = await searchParams;
  const parsedPage = resolvedSearchParams.page ? parseInt(resolvedSearchParams.page, 10) : 1;
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const boardId = resolvedSearchParams.boardId;

  return (
    <div className="w-full">
      <Suspense fallback={<ActivityList.Skeleton />}>
        <ActivityList
          page={page}
          boardId={boardId}
          eventType={resolvedSearchParams.eventType}
          userId={resolvedSearchParams.userId}
          range={resolvedSearchParams.range}
          from={resolvedSearchParams.from}
          to={resolvedSearchParams.to}
          q={resolvedSearchParams.q}
          searchParams={resolvedSearchParams}
        />
      </Suspense>
    </div>
  );
};

export default ActivityPage;
