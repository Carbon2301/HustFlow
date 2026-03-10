import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { HelpCircle, LayoutGrid, Plus } from "lucide-react";

import { db } from "@/lib/db";
import { Hint } from "@/components/hint";
import { Skeleton } from "@/components/ui/skeleton";
import { FormPopover } from "@/components/form/form-popover";
import { MAX_FREE_BOARDS } from "@/constants/boards";
import { getAvailableCount } from "@/lib/org-limit";
import { measureDev } from "@/lib/perf";
import { checkSubscription } from "@/lib/subscription";

type BoardListProps = {
  isPro?: boolean;
};

export const BoardList = async ({
  isPro: isProProp,
}: BoardListProps = {}) => {
  const { orgId, userId } = await auth();

  if (!orgId || !userId) {
    return redirect("/select-org");
  }

  const [boards, availableCount, isPro] = await measureDev(`organization:${orgId}:board-list`, () => Promise.all([
    db.board.findMany({
      where: {
        orgId,
        members: {
          some: {
            userId,
          },
        },
      },
      orderBy: {
        createdAt: "desc"
      }
    }),
    getAvailableCount(),
    isProProp === undefined ? checkSubscription() : Promise.resolve(isProProp),
  ]));

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-x-2 text-neutral-700 font-semibold text-sm">
        <LayoutGrid className="h-4 w-4 text-violet-600" />
        <span>Bảng của bạn</span>
        <span className="text-neutral-400 font-normal text-xs ml-1">
          ({boards.length})
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {boards.map((board) => (
          <Link
            key={board.id}
            href={`/board/${board.id}`}
            className="group relative aspect-video bg-no-repeat bg-center bg-cover bg-neutral-800 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-200"
            style={{ backgroundImage: `url(${board.imageThumbUrl})` }}
          >
            <div className="absolute inset-0 bg-black/30 group-hover:bg-black/45 transition-colors duration-200" />
            <div className="absolute bottom-0 left-0 right-0 p-2.5">
              <p className="relative font-semibold text-white text-sm leading-tight drop-shadow-sm">
                {board.title}
              </p>
            </div>
          </Link>
        ))}
        <FormPopover sideOffset={10} side="right">
          <div
            role="button"
            className="group aspect-video relative h-full w-full bg-neutral-100 border-2 border-dashed border-neutral-200 rounded-xl flex flex-col gap-y-1.5 items-center justify-center hover:bg-violet-50 hover:border-violet-300 transition-all duration-200 cursor-pointer"
          >
            <Plus className="h-5 w-5 text-neutral-400 group-hover:text-violet-500 transition-colors" />
            <p className="text-sm font-medium text-neutral-500 group-hover:text-violet-600 transition-colors">
              Tạo bảng
            </p>
            <span className="text-xs text-neutral-400 group-hover:text-violet-400 transition-colors">
              {isPro ? "Không giới hạn" : `Còn lại ${MAX_FREE_BOARDS - availableCount}`}
            </span>
            <Hint
              sideOffset={12}
              description={`Không gian làm việc miễn phí được tạo tối đa ${MAX_FREE_BOARDS} bảng. Nâng cấp lên Pro để có số lượng bảng không giới hạn.`}
            >
              <HelpCircle
                className="absolute bottom-2 right-2 h-3.5 w-3.5 text-neutral-300 hover:text-neutral-500 transition-colors"
              />
            </Hint>
          </div>
        </FormPopover>
      </div>
    </div>
  );
};

BoardList.Skeleton = function SkeletonBoardList() {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-x-2">
        <Skeleton className="h-4 w-4 rounded" />
        <Skeleton className="h-4 w-28 rounded" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="aspect-video h-full w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
};
