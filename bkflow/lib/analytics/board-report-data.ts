import "server-only";

import { db } from "@/lib/db";

export type BoardReportRange = "7d" | "30d";

export type BoardAnalyticsData = Awaited<ReturnType<typeof getBoardAnalyticsData>>;

type GetBoardAnalyticsDataInput = {
  boardId: string;
  orgId: string;
  range?: BoardReportRange;
  includeReportContext?: boolean;
};

const rangeToDays: Record<BoardReportRange, number> = {
  "7d": 7,
  "30d": 30,
};

const trimToLength = (value: string | null | undefined, maxLength: number) =>
  (value ?? "").replace(/\s+/g, " ").trim().slice(0, maxLength);

const getRangeStart = (range: BoardReportRange) => {
  const start = new Date();
  start.setDate(start.getDate() - rangeToDays[range]);

  return start;
};

export const getBoardAnalyticsData = async ({
  boardId,
  orgId,
  range = "7d",
  includeReportContext = false,
}: GetBoardAnalyticsDataInput) => {
  const rangeStart = getRangeStart(range);
  const now = new Date();

  const [board, lists, boardMembers, auditLogs] = await Promise.all([
    db.board.findFirst({
      where: {
        id: boardId,
        orgId,
      },
      select: {
        id: true,
        title: true,
      },
    }),
    db.list.findMany({
      where: {
        boardId,
        archivedAt: null,
        board: {
          orgId,
        },
      },
      select: {
        id: true,
        title: true,
        order: true,
        cards: {
          where: {
            archivedAt: null,
          },
          select: {
            id: true,
            title: true,
            order: true,
            listId: true,
            startDate: true,
            dueDate: true,
            isCompleted: true,
            createdAt: true,
            updatedAt: true,
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
            checklists: {
              select: {
                title: true,
                items: {
                  select: {
                    id: true,
                    isCompleted: true,
                  },
                },
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
    includeReportContext
      ? db.auditLog.findMany({
          where: {
            orgId,
            boardId,
            createdAt: {
              gte: rangeStart,
            },
          },
          select: {
            id: true,
            action: true,
            eventType: true,
            entityType: true,
            entityTitle: true,
            cardId: true,
            userName: true,
            createdAt: true,
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 60,
        })
      : Promise.resolve([]),
  ]);

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

  const listDistribution = lists.map((list) => ({
    id: list.id,
    name: list.title,
    count: list.cards.length,
  }));
  const averageCardsPerList = listDistribution.length === 0
    ? 0
    : totalCards / listDistribution.length;
  const heavyLists = listDistribution
    .filter((list) => list.count >= 3 && list.count > Math.max(averageCardsPerList * 1.5, averageCardsPerList + 2))
    .sort((left, right) => right.count - left.count);

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

  const checklistProgressByCard = cards
    .map((card) => {
      const totalItems = card.checklists.reduce((count, checklist) => count + checklist.items.length, 0);
      const completedItems = card.checklists.reduce(
        (count, checklist) => count + checklist.items.filter((item) => item.isCompleted).length,
        0,
      );

      return {
        cardId: card.id,
        cardTitle: trimToLength(card.title, 120),
        listTitle: card.listTitle,
        totalItems,
        completedItems,
        remainingItems: totalItems - completedItems,
        completionRate: totalItems === 0 ? null : Math.round((completedItems / totalItems) * 100),
      };
    })
    .filter((item) => item.totalItems > 0);

  const checklistTotals = checklistProgressByCard.reduce(
    (totals, card) => ({
      totalItems: totals.totalItems + card.totalItems,
      completedItems: totals.completedItems + card.completedItems,
    }),
    {
      totalItems: 0,
      completedItems: 0,
    },
  );

  const reportContext = includeReportContext
    ? {
        board: {
          id: board?.id ?? boardId,
          title: trimToLength(board?.title, 120),
        },
        range,
        generatedAt: now.toISOString(),
        rangeStart: rangeStart.toISOString(),
        kpis: {
          totalCards,
          completedCards,
          overdueCards,
          unassignedCards: unassignedCount,
          unscheduledCards,
          completionRate,
        },
        listDistribution,
        workload: workloadData,
        scheduleHealth: {
          completed: completedCards,
          activeWithDueDate: cards.filter((card) => card.dueDate && card.dueDate >= now && !card.isCompleted).length,
          overdue: overdueCards,
          withoutDueDate: cards.filter((card) => !card.dueDate && !card.isCompleted).length,
        },
        completedCardsInRange: cards
          .filter((card) => card.isCompleted && card.updatedAt >= rangeStart)
          .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime())
          .slice(0, 12)
          .map((card) => ({
            id: card.id,
            title: trimToLength(card.title, 120),
            listTitle: card.listTitle,
            updatedAt: card.updatedAt.toISOString(),
          })),
        overdueCards: overdueCardInsights.slice(0, 12).map((card) => ({
          title: trimToLength(card.title, 120),
          listTitle: card.listTitle,
          dueDate: card.dueDate,
        })),
        unassignedCards: cards
          .filter((card) => card.assignees.length === 0 && !card.isCompleted)
          .slice(0, 12)
          .map((card) => ({
            title: trimToLength(card.title, 120),
            listTitle: card.listTitle,
            dueDate: card.dueDate?.toISOString() ?? null,
          })),
        heavyLists,
        checklistProgress: {
          totalItems: checklistTotals.totalItems,
          completedItems: checklistTotals.completedItems,
          lowProgressCards: checklistProgressByCard
            .filter((card) => card.totalItems >= 3 && (card.completionRate ?? 100) < 50)
            .sort((left, right) => right.remainingItems - left.remainingItems)
            .slice(0, 8),
        },
        recentActivity: auditLogs.slice(0, 25).map((log) => ({
          action: log.action,
          eventType: log.eventType,
          entityType: log.entityType,
          entityTitle: trimToLength(log.entityTitle, 120),
          userName: trimToLength(log.userName, 80),
          createdAt: log.createdAt.toISOString(),
        })),
      }
    : null;

  return {
    kpis: {
      totalCards,
      completedCards,
      overdueCards,
      unscheduledCards,
      completionRate,
    },
    listDistribution,
    workload: workloadData,
    scheduleHealth: [
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
    ],
    insights: {
      overdueCards: overdueCardInsights,
    },
    reportContext,
  };
};
