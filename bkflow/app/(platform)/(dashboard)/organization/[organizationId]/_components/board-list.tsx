import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import {
  Archive,
  CalendarClock,
  CheckCircle2,
  CircleDashed,
  HelpCircle,
  LayoutGrid,
  Lock,
  Plus,
} from "lucide-react";

import { db } from "@/lib/db";
import { Hint } from "@/components/hint";
import { Skeleton } from "@/components/ui/skeleton";
import { FormPopover } from "@/components/form/form-popover";
import { MAX_FREE_BOARDS } from "@/constants/boards";
import { getAvailableCount } from "@/lib/org-limit";
import { measureDev } from "@/lib/perf";
import { checkSubscription } from "@/lib/billing/subscription";
import { isOrganizationAdmin } from "@/lib/organization-permissions";

import { UpgradeBillingTile } from "./upgrade-billing-tile";

type BoardListProps = {
  isPro?: boolean;
};

type WorkspaceStatsProps = {
  totalCards: number;
  completedCards: number;
  overdueCards: number;
  unscheduledCards: number;
};

const WorkspaceStats = ({
  totalCards,
  completedCards,
  overdueCards,
  unscheduledCards,
}: WorkspaceStatsProps) => {
  const completionRate = totalCards === 0
    ? 0
    : Math.round((completedCards / totalCards) * 100);

  const statistics = [
    {
      label: "Tổng số thẻ",
      value: totalCards,
      icon: Archive,
      iconClassName: "bg-sky-50 text-sky-600 ring-sky-100",
    },
    {
      label: "Hoàn thành",
      value: completedCards,
      icon: CheckCircle2,
      iconClassName: "bg-emerald-50 text-emerald-600 ring-emerald-100",
    },
    {
      label: "Quá hạn",
      value: overdueCards,
      icon: CircleDashed,
      iconClassName: "bg-rose-50 text-rose-600 ring-rose-100",
    },
    {
      label: "Chưa lên lịch",
      value: unscheduledCards,
      icon: CalendarClock,
      iconClassName: "bg-amber-50 text-amber-600 ring-amber-100",
    },
    {
      label: "Tỷ lệ hoàn thành",
      value: `${completionRate}%`,
      icon: LayoutGrid,
      iconClassName: "bg-blue-50 text-blue-600 ring-blue-100",
    },
  ];

  return (
    <section aria-label="Thống kê không gian làm việc" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {statistics.map(({ label, value, icon: Icon, iconClassName }) => (
        <div
          key={label}
          className="flex min-h-28 items-center justify-between rounded-2xl border border-neutral-100 bg-white px-5 py-4 shadow-sm"
        >
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              {label}
            </p>
            <p className="mt-1 text-3xl font-bold leading-none text-neutral-900">
              {value}
            </p>
          </div>
          <div className={`ml-3 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ring-1 ${iconClassName}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      ))}
    </section>
  );
};

export const BoardList = async ({
  isPro: isProProp,
}: BoardListProps = {}) => {
  const { orgId, userId } = await auth();

  if (!orgId || !userId) {
    return redirect("/select-org");
  }

  const [boards, availableCount, isPro, isOrgAdmin] = await measureDev(
    `organization:${orgId}:board-list`,
    () => Promise.all([
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
          createdAt: "desc",
        },
        include: {
          lists: {
            where: {
              archivedAt: null,
            },
            select: {
              cards: {
                where: {
                  archivedAt: null,
                },
                select: {
                  isCompleted: true,
                  dueDate: true,
                },
              },
            },
          },
        },
      }),
      getAvailableCount(),
      isProProp === undefined ? checkSubscription() : Promise.resolve(isProProp),
      isOrganizationAdmin(orgId, userId),
    ]),
  );

  const remainingBoards = Math.max(MAX_FREE_BOARDS - availableCount, 0);
  const hasReachedFreeLimit = !isPro && remainingBoards <= 0;
  const cards = boards.flatMap((board) => board.lists.flatMap((list) => list.cards));
  const now = new Date();
  const totalCards = cards.length;
  const completedCards = cards.filter((card) => card.isCompleted).length;
  const overdueCards = cards.filter(
    (card) => !card.isCompleted && card.dueDate !== null && card.dueDate < now,
  ).length;
  const unscheduledCards = cards.filter((card) => card.dueDate === null).length;

  return (
    <div className="space-y-5">
      <WorkspaceStats
        totalCards={totalCards}
        completedCards={completedCards}
        overdueCards={overdueCards}
        unscheduledCards={unscheduledCards}
      />
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
        {!hasReachedFreeLimit && (
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
                {isPro ? "Không giới hạn" : `Còn lại ${remainingBoards}`}
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
        )}
        {hasReachedFreeLimit && isOrgAdmin && <UpgradeBillingTile />}
        {hasReachedFreeLimit && !isOrgAdmin && (
          <div className="aspect-video relative h-full w-full bg-neutral-100 border-2 border-dashed border-neutral-200 rounded-xl flex flex-col gap-y-1.5 items-center justify-center text-center px-4">
            <Lock className="h-5 w-5 text-neutral-400" />
            <p className="text-sm font-medium text-neutral-600">
              Đã đạt giới hạn bảng
            </p>
            <span className="text-xs text-neutral-400">
              Tổ chức đã đạt giới hạn {MAX_FREE_BOARDS} bảng. Vui lòng liên hệ quản trị viên tổ chức để nâng cấp.
            </span>
          </div>
        )}
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
