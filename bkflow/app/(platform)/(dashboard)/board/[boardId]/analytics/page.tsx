import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { requireBoardMember } from "@/lib/permissions";

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

  if (!orgId || !userId) {
    redirect("/select-org");
  }

  const currentMembership = await requireBoardMember({ boardId, orgId, userId });

  if (currentMembership.error || !currentMembership.membership) {
    const errorMessage = currentMembership.error || "Bạn không có quyền truy cập bảng này.";
    redirect(`/organization/${orgId}?error=${encodeURIComponent(errorMessage)}`);
  }

  const [lists, boardMembers] = await Promise.all([
    db.list.findMany({
      where: {
        boardId,
        board: {
          orgId,
        },
      },
      select: {
        id: true,
        title: true,
        order: true,
        cards: {
          select: {
            id: true,
            title: true,
            order: true,
            listId: true,
            startDate: true,
            dueDate: true,
            isCompleted: true,
            assignees: {
              select: {
                id: true,
                boardMember: {
                  select: {
                    id: true,
                    userName: true,
                    userImage: true,
                  },
                },
              },
              orderBy: {
                createdAt: "asc",
              },
            },
            labels: {
              select: {
                label: {
                  select: {
                    id: true,
                    title: true,
                    color: true,
                  },
                },
              },
              orderBy: {
                createdAt: "asc",
              },
            },
            _count: {
              select: {
                comments: true,
                attachments: true,
              },
            },
          },
          orderBy: {
            order: "asc",
          },
        },
      },
      orderBy: {
        order: "asc",
      },
    }),
    db.boardMember.findMany({
      where: {
        boardId,
        board: {
          orgId,
          members: {
            some: {
              userId,
            },
          },
        },
      },
      select: {
        id: true,
        userName: true,
        userImage: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    }),
  ]);

  const now = new Date();
  const cards = lists.flatMap((list) =>
    list.cards.map((card) => ({
      ...card,
      listTitle: list.title,
      listOrder: list.order,
    })),
  );

  const totalCards = cards.length;
  const completedCards = cards.filter((card) => card.isCompleted).length;
  const overdueCards = cards.filter((card) => card.dueDate && card.dueDate < now && !card.isCompleted).length;
  const unscheduledCards = cards.filter((card) => !card.startDate && !card.dueDate).length;
  const completionRate = totalCards === 0 ? 0 : Math.round((completedCards / totalCards) * 100);

  const workloadMap = new Map(
    boardMembers.map((member) => [
      member.id,
      {
        id: member.id,
        name: member.userName,
        count: 0,
      },
    ]),
  );

  let unassignedCount = 0;

  for (const card of cards) {
    if (card.assignees.length === 0) {
      unassignedCount += 1;
      continue;
    }

    for (const assignee of card.assignees) {
      const memberWorkload = workloadMap.get(assignee.boardMember.id);

      if (memberWorkload) {
        memberWorkload.count += 1;
      }
    }
  }

  const workloadData = [
    ...Array.from(workloadMap.values()),
    {
      id: "unassigned",
      name: "Chưa giao",
      count: unassignedCount,
    },
  ];

  const overdueCardInsights = cards
    .filter((card) => card.dueDate && card.dueDate < now && !card.isCompleted)
    .sort((left, right) => left.dueDate!.getTime() - right.dueDate!.getTime())
    .map((card) => ({
      id: card.id,
      title: card.title,
      listTitle: card.listTitle,
      dueDate: card.dueDate!.toISOString(),
      labels: card.labels.map(({ label }) => label),
    }));

  return (
    <BoardAnalyticsView
      kpis={{
        totalCards,
        completedCards,
        overdueCards,
        unscheduledCards,
        completionRate,
      }}
      listDistribution={lists.map((list) => ({
        id: list.id,
        name: list.title,
        count: list.cards.length,
      }))}
      workload={workloadData}
      scheduleHealth={[
        {
          name: "Hoàn thành",
          value: completedCards,
        },
        {
          name: "Đang làm",
          value: cards.filter((card) => card.dueDate && card.dueDate >= now && !card.isCompleted).length,
        },
        {
          name: "Quá hạn",
          value: overdueCards,
        },
        {
          name: "Chưa có hạn",
          value: cards.filter((card) => !card.dueDate && !card.isCompleted).length,
        },
      ]}
      insights={{
        overdueCards: overdueCardInsights,
      }}
    />
  );
};

export default BoardAnalyticsPage;
