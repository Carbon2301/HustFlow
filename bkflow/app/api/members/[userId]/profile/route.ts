import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { BoardMemberRole, Prisma } from "@prisma/client";

import { db } from "@/lib/db";

const ACTIVITY_PAGE_SIZE = 30;

const parsePage = (value: string | null) => {
  const page = value ? Number.parseInt(value, 10) : 1;

  return Number.isFinite(page) && page > 0 ? page : 1;
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const { userId: targetUserId } = await params;
    const { userId: currentUserId, orgId } = await auth();

    if (!currentUserId || !orgId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const boardId = searchParams.get("boardId");
    const activityPage = parsePage(searchParams.get("activityPage"));

    const accessibleBoards = await db.board.findMany({
      where: {
        orgId,
        members: {
          some: {
            userId: currentUserId,
          },
        },
      },
      select: {
        id: true,
        title: true,
        imageThumbUrl: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const accessibleBoardIds = accessibleBoards.map((board) => board.id);

    if (accessibleBoardIds.length === 0) {
      return NextResponse.json({
        member: null,
        activity: { items: [], hasMore: false, page: activityPage },
        cards: [],
        labels: [],
        boards: [],
      });
    }

    const targetMemberships = await db.boardMember.findMany({
      where: {
        userId: targetUserId,
        boardId: {
          in: accessibleBoardIds,
        },
        board: {
          orgId,
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    const preferredMembership =
      (boardId
        ? targetMemberships.find((member) => member.boardId === boardId)
        : null) ?? targetMemberships[0] ?? null;

    const member = preferredMembership
      ? {
          id: preferredMembership.id,
          boardId: preferredMembership.boardId,
          userId: preferredMembership.userId,
          userName: preferredMembership.userName,
          userImage: preferredMembership.userImage,
          userEmail: preferredMembership.userEmail,
          role: preferredMembership.role,
        }
      : null;

    const auditWhere: Prisma.AuditLogWhereInput = {
      orgId,
      userId: targetUserId,
      boardId: {
        in: accessibleBoardIds,
      },
    };

    const [activityItems, activityTotal, assignedCards, memberNames, existingLists] =
      await Promise.all([
        db.auditLog.findMany({
          where: auditWhere,
          orderBy: {
            createdAt: "desc",
          },
          skip: (activityPage - 1) * ACTIVITY_PAGE_SIZE,
          take: ACTIVITY_PAGE_SIZE,
        }),
        db.auditLog.count({
          where: auditWhere,
        }),
        db.card.findMany({
          where: {
            archivedAt: null,
            assignees: {
              some: {
                boardMember: {
                  userId: targetUserId,
                  role: {
                    not: BoardMemberRole.VIEWER,
                  },
                  boardId: {
                    in: accessibleBoardIds,
                  },
                },
              },
            },
            list: {
              archivedAt: null,
              board: {
                orgId,
                id: {
                  in: accessibleBoardIds,
                },
              },
            },
          },
          include: {
            list: {
              select: {
                id: true,
                title: true,
                board: {
                  select: {
                    id: true,
                    title: true,
                    imageThumbUrl: true,
                  },
                },
              },
            },
            assignees: {
              where: {
                boardMember: {
                  role: {
                    not: BoardMemberRole.VIEWER,
                  },
                },
              },
              include: {
                boardMember: true,
              },
              orderBy: {
                createdAt: "asc",
              },
            },
            labels: {
              include: {
                label: true,
              },
              orderBy: {
                createdAt: "asc",
              },
            },
          },
          orderBy: [
            {
              dueDate: "asc",
            },
            {
              updatedAt: "desc",
            },
          ],
        }),
        db.boardMember.findMany({
          where: {
            boardId: {
              in: accessibleBoardIds,
            },
          },
          select: {
            userName: true,
          },
        }),
        db.list.findMany({
          where: {
            archivedAt: null,
            boardId: {
              in: accessibleBoardIds,
            },
          },
          select: {
            id: true,
          },
        }),
      ]);

    const activityCardIds = Array.from(
      new Set(
        activityItems
          .map((log) => log.cardId || (log.entityType === "CARD" ? log.entityId : null))
          .filter(Boolean),
      ),
    ) as string[];

    const activityCards = activityCardIds.length
      ? await db.card.findMany({
          where: {
            id: {
              in: activityCardIds,
            },
            list: {
              board: {
                orgId,
                id: {
                  in: accessibleBoardIds,
                },
              },
            },
          },
          select: {
            id: true,
            title: true,
            archivedAt: true,
            list: {
              select: {
                archivedAt: true,
              },
            },
          },
        })
      : [];

    const cardMap = new Map(
      activityCards.map((card) => [
        card.id,
        {
          title: card.title,
          isArchived: card.archivedAt !== null || card.list.archivedAt !== null,
        },
      ]),
    );
    const boardMap = new Map(accessibleBoards.map((board) => [board.id, board.title]));
    const existingListIds = new Set(existingLists.map((list) => list.id));

    const labels = new Map<
      string,
      { id: string; title: string; color: string; boardId: string }
    >();

    const cards = assignedCards.map((card) => {
      card.labels.forEach((cardLabel) => {
        labels.set(cardLabel.label.id, {
          id: cardLabel.label.id,
          title: cardLabel.label.title,
          color: cardLabel.label.color,
          boardId: card.list.board.id,
        });
      });

      return {
        id: card.id,
        title: card.title,
        listId: card.list.id,
        listTitle: card.list.title,
        dueDate: card.dueDate,
        startDate: card.startDate,
        isCompleted: card.isCompleted,
        board: card.list.board,
        assignees: card.assignees.map((assignee) => ({
          id: assignee.id,
          boardMemberId: assignee.boardMemberId,
          userId: assignee.boardMember.userId,
          userName: assignee.boardMember.userName,
          userImage: assignee.boardMember.userImage,
        })),
        labels: card.labels.map((cardLabel) => ({
          id: cardLabel.id,
          labelId: cardLabel.labelId,
          label: {
            id: cardLabel.label.id,
            title: cardLabel.label.title,
            color: cardLabel.label.color,
          },
        })),
      };
    });

    const activity = activityItems.map((log) => {
      const resolvedCardId = log.cardId || (log.entityType === "CARD" ? log.entityId : null);
      const cardInfo = resolvedCardId ? cardMap.get(resolvedCardId) : undefined;

      return {
        log,
        boardTitle: log.boardId ? boardMap.get(log.boardId) : undefined,
        cardTitle: cardInfo?.title,
        cardArchived: cardInfo?.isArchived ?? false,
        listExists: log.entityType === "LIST" ? existingListIds.has(log.entityId) : true,
      };
    });

    return NextResponse.json({
      member,
      activity: {
        items: activity,
        hasMore: activityPage * ACTIVITY_PAGE_SIZE < activityTotal,
        page: activityPage,
      },
      cards,
      labels: Array.from(labels.values()),
      boards: accessibleBoards,
      memberNames: Array.from(
        new Set([
          ...targetMemberships.map((member) => member.userName),
          ...memberNames.map((member) => member.userName),
        ]),
      ).filter(Boolean),
    });
  } catch (error) {
    console.error("[MEMBER_PROFILE_GET_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
