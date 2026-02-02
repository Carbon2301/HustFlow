import { Suspense } from "react";

import { Separator } from "@/components/ui/separator";

import { Info } from "../_components/info";

import { ActivityList } from "./_components/activity-list";
import { checkSubscription } from "@/lib/subscription";

interface ActivityPageProps {
  searchParams: Promise<{ page?: string; boardId?: string }>;
}

const ActivityPage = async ({ searchParams }: ActivityPageProps) => {
  const resolvedSearchParams = await searchParams;
  const parsedPage = resolvedSearchParams.page ? parseInt(resolvedSearchParams.page, 10) : 1;
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const boardId = resolvedSearchParams.boardId;
  const isPro = await checkSubscription();

  return (
    <div className="w-full">
      <Info isPro={isPro} />
      <Separator className="my-2" />
      <Suspense fallback={<ActivityList.Skeleton />}>
        <ActivityList
          page={page}
          boardId={boardId}
          searchParams={resolvedSearchParams}
        />
      </Suspense>
    </div>
  );
};

export default ActivityPage;
