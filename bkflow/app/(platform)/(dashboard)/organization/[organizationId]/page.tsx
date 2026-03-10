import { Suspense } from "react";

import { Separator } from "@/components/ui/separator";

import { Info } from "./_components/info";
import { BoardList } from "./_components/board-list";
import { checkSubscription } from "@/lib/subscription";

const OrganizationIdPage = async () => {
  const isPro = await checkSubscription();

  return (
    <div className="w-full mb-20">
      <Info isPro={isPro} />
      <Separator className="my-4" />
      <div className="w-full">
        <Suspense fallback={<BoardList.Skeleton />}>
          <BoardList isPro={isPro} />
        </Suspense>
      </div>
    </div>
  );
};

export default OrganizationIdPage;
