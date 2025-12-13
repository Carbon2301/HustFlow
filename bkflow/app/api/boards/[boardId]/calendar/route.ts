import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { requireBoardMember } from "@/lib/permissions";
import type {
  BoardCalendarCardItem,
  BoardCalendarChecklistItem,
  BoardCalendarItem,
  BoardCalendarResponse,
  BoardCalendarUnscheduledCard,
} from "@/types";

const MAX_RANGE_DAYS = 370;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

const parseRequiredDateParam = (
  searchParams: URLSearchParams,
  key: "from" | "to",
) => {
  const value = searchParams.get(key);

  if (!value) {
    return {
      error: `Missing required "${key}" query parameter.`,
      date: null,
    };
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return {
      error: `Invalid "${key}" query parameter. Use an ISO date string.`,
      date: null,
    };
  }

  return {
    error: null,
    date,
  };
};

const getEffectiveStartTime = (item: BoardCalendarItem) => {
  const effectiveDate = item.type === "card"
    ? item.startDate ?? item.dueDate
    : item.dueDate;

  return effectiveDate ? new Date(effectiveDate).getTime() : 0;
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string }> },
) {
  try {
    const { boardId } = await params;
    const { userId, orgId } = await auth();

    if (!userId || !orgId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const fromResult = parseRequiredDateParam(
      request.nextUrl.searchParams,
      "from",
    );
    const toResult = parseRequiredDateParam(
      request.nextUrl.searchParams,
      "to",
    );

    if (fromResult.error) {
      return NextResponse.json({ error: fromResult.error }, { status: 400 });
    }

    if (toResult.error) {
      return NextResponse.json({ error: toResult.error }, { status: 400 });
    }

    const from = fromResult.date;
    const to = toResult.date;
    const includeUnscheduled =
      request.nextUrl.searchParams.get("includeUnscheduled") === "true";

    if (!from || !to) {
      return NextResponse.json(
        { error: "Invalid calendar date range." },
        { status: 400 },
      );
    }

    if (from.getTime() > to.getTime()) {
      return NextResponse.json(
        { error: '"from" must be before or equal to "to".' },
        { status: 400 },
      );
    }

    if (to.getTime() - from.getTime() > MAX_RANGE_DAYS * DAY_IN_MS) {
      return NextResponse.json(
        { error: `Calendar range cannot exceed ${MAX_RANGE_DAYS} days.` },
        { status: 400 },
      );
    }

    const permission = await requireBoardMember({ boardId, orgId, userId });

    if (permission.error) {
      return new NextResponse(permission.error, { status: 403 });
    }

    const [cards, checklistItems, unscheduledCards] = await Promise.all([
      db.card.findMany({
        where: {
          list: {
            board: {
              id: boardId,
              orgId,
            },
          },
          OR: [
            {
              dueDate: {
                gte: from,
                lte: to,
              },
            },
            {
              startDate: {
                gte: from,
                lte: to,
              },
            },
            {
              AND: [
                {
                  startDate: {
                    not: null,
                    lte: to,
                  },
                },
                {
                  dueDate: {
                    not: null,
                    gte: from,
                  },
                },
              ],
            },
          ],
        },
        select: {
          id: true,
          title: true,
          order: true,
          startDate: true,
          dueDate: true,
          isCompleted: true,
          reminder: true,
          listId: true,
          list: {
            select: {
              title: true,
              order: true,
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
          assignees: {
            select: {
              id: true,
              boardMemberId: true,
              boardMember: {
                select: {
                  userId: true,
                  userName: true,
                  userImage: true,
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
            },
          },
        },
      }),
      db.checklistItem.findMany({
        where: {
          dueDate: {
            gte: from,
            lte: to,
          },
          checklist: {
            card: {
              list: {
                board: {
                  id: boardId,
                  orgId,
                },
              },
            },
          },
        },
        select: {
          id: true,
          title: true,
          dueDate: true,
          isCompleted: true,
          order: true,
          checklistId: true,
          checklist: {
            select: {
              title: true,
              order: true,
              cardId: true,
              card: {
                select: {
                  id: true,
                  title: true,
                  order: true,
                  listId: true,
                  list: {
                    select: {
                      title: true,
                      order: true,
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
                },
              },
            },
          },
          assignee: {
            select: {
              id: true,
              userId: true,
              userName: true,
              userImage: true,
            },
          },
        },
      }),
      includeUnscheduled
        ? db.card.findMany({
            where: {
              startDate: null,
              dueDate: null,
              list: {
                board: {
                  id: boardId,
                  orgId,
                },
              },
            },
            select: {
              id: true,
              title: true,
              order: true,
              isCompleted: true,
              listId: true,
              list: {
                select: {
                  title: true,
                  order: true,
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
              assignees: {
                select: {
                  id: true,
                  boardMemberId: true,
                  boardMember: {
                    select: {
                      userId: true,
                      userName: true,
                      userImage: true,
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
                },
              },
            },
            orderBy: [
              {
                list: {
                  order: "asc",
                },
              },
              {
                order: "asc",
              },
            ],
          })
        : Promise.resolve([]),
    ]);

    const cardItems = cards.map((card) => ({
      item: {
        type: "card" as const,
        id: `card:${card.id}`,
        cardId: card.id,
        boardId,
        listId: card.listId,
        listTitle: card.list.title,
        title: card.title,
        startDate: card.startDate?.toISOString() ?? null,
        dueDate: card.dueDate?.toISOString() ?? null,
        isCompleted: card.isCompleted,
        reminder: card.reminder,
        labels: card.labels.map(({ label }) => ({
          id: label.id,
          title: label.title,
          color: label.color,
        })),
        assignees: card.assignees.map((assignee) => ({
          id: assignee.id,
          boardMemberId: assignee.boardMemberId,
          userId: assignee.boardMember.userId,
          userName: assignee.boardMember.userName,
          userImage: assignee.boardMember.userImage,
        })),
        commentCount: card._count.comments,
      } satisfies BoardCalendarCardItem,
      listOrder: card.list.order,
      cardOrder: card.order,
      checklistOrder: -1,
      checklistItemOrder: -1,
    }));

    const checklistCalendarItems = checklistItems.flatMap((item) => {
      if (!item.dueDate) {
        return [];
      }

      return [{
        item: {
          type: "checklist-item" as const,
          id: `checklist-item:${item.id}`,
          checklistItemId: item.id,
          checklistId: item.checklistId,
          checklistTitle: item.checklist.title,
          cardId: item.checklist.cardId,
          cardTitle: item.checklist.card.title,
          boardId,
          listId: item.checklist.card.listId,
          listTitle: item.checklist.card.list.title,
          title: item.title,
          dueDate: item.dueDate.toISOString(),
          isCompleted: item.isCompleted,
          assignee: item.assignee
            ? {
                id: item.assignee.id,
                boardMemberId: item.assignee.id,
                userId: item.assignee.userId,
                userName: item.assignee.userName,
                userImage: item.assignee.userImage,
              }
            : null,
          labels: item.checklist.card.labels.map(({ label }) => ({
            id: label.id,
            title: label.title,
            color: label.color,
          })),
        } satisfies BoardCalendarChecklistItem,
        listOrder: item.checklist.card.list.order,
        cardOrder: item.checklist.card.order,
        checklistOrder: item.checklist.order,
        checklistItemOrder: item.order,
      }];
    });

    const items: BoardCalendarItem[] = [...cardItems, ...checklistCalendarItems]
      .sort((left, right) => {
        const startDelta =
          getEffectiveStartTime(left.item) - getEffectiveStartTime(right.item);

        if (startDelta !== 0) {
          return startDelta;
        }

        if (left.item.isCompleted !== right.item.isCompleted) {
          return left.item.isCompleted ? 1 : -1;
        }

        if (left.item.type !== right.item.type) {
          return left.item.type === "card" ? -1 : 1;
        }

        return left.listOrder - right.listOrder ||
          left.cardOrder - right.cardOrder ||
          left.checklistOrder - right.checklistOrder ||
          left.checklistItemOrder - right.checklistItemOrder;
      })
      .map(({ item }) => item);

    const mappedUnscheduledCards: BoardCalendarUnscheduledCard[] = unscheduledCards
      .map((card) => ({
        type: "unscheduled-card" as const,
        id: `unscheduled-card:${card.id}`,
        cardId: card.id,
        boardId,
        listId: card.listId,
        listTitle: card.list.title,
        title: card.title,
        isCompleted: card.isCompleted,
        labels: card.labels.map(({ label }) => ({
          id: label.id,
          title: label.title,
          color: label.color,
        })),
        assignees: card.assignees.map((assignee) => ({
          id: assignee.id,
          boardMemberId: assignee.boardMemberId,
          userId: assignee.boardMember.userId,
          userName: assignee.boardMember.userName,
          userImage: assignee.boardMember.userImage,
        })),
        commentCount: card._count.comments,
        order: card.order,
        listOrder: card.list.order,
      }));

    const response: BoardCalendarResponse = {
      boardId,
      from: from.toISOString(),
      to: to.toISOString(),
      items,
      unscheduledCards: mappedUnscheduledCards,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[BOARD_CALENDAR_GET_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
