import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { requireBoardMember } from "@/lib/permissions";

const ITEMS_PER_PAGE = 50;

const getPage = (value: string | null) => {
  const page = value ? Number.parseInt(value, 10) : 1;
  return Number.isFinite(page) && page > 0 ? page : 1;
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

    const permission = await requireBoardMember({ boardId, orgId, userId });

    if (permission.error) {
      return new NextResponse(permission.error, { status: 403 });
    }

    const page = getPage(request.nextUrl.searchParams.get("page"));

    const logs = await db.auditLog.findMany({
      where: {
        orgId,
        boardId,
      },
      orderBy: {
        createdAt: "desc",
      },
      skip: (page - 1) * ITEMS_PER_PAGE,
      take: ITEMS_PER_PAGE + 1,
    });
    const hasMore = logs.length > ITEMS_PER_PAGE;
    const auditLogs = logs.slice(0, ITEMS_PER_PAGE);

    const cardIds = Array.from(
      new Set(
        auditLogs
          .map((log) => log.cardId || (log.entityType === "CARD" ? log.entityId : null))
          .filter(Boolean),
      ),
    ) as string[];
    const checklistIds = Array.from(
      new Set(
        auditLogs
          .filter((log) => log.entityType === "CHECKLIST")
          .map((log) => log.entityId),
      ),
    );
    const checklistItemIds = Array.from(
      new Set(
        auditLogs
          .filter((log) => log.entityType === "CHECKLIST_ITEM")
          .map((log) => log.entityId),
      ),
    );

    const [existingCards, boardMembers, lists, checklists, checklistItems] = await Promise.all([
      cardIds.length > 0
        ? db.card.findMany({
            where: {
              id: {
                in: cardIds,
              },
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
              archivedAt: true,
              list: {
                select: {
                  archivedAt: true,
                },
              },
            },
          })
        : Promise.resolve([]),
      db.boardMember.findMany({
        where: {
          boardId,
          board: {
            orgId,
          },
        },
        select: {
          userName: true,
        },
      }),
      db.list.findMany({
        where: {
          archivedAt: null,
          board: {
            id: boardId,
            orgId,
          },
        },
        select: {
          id: true,
        },
      }),
      checklistIds.length > 0
        ? db.checklist.findMany({
            where: {
              id: {
                in: checklistIds,
              },
              card: {
                list: {
                  board: {
                    id: boardId,
                    orgId,
                  },
                },
              },
            },
            select: {
              id: true,
            },
          })
        : Promise.resolve([]),
      checklistItemIds.length > 0
        ? db.checklistItem.findMany({
            where: {
              id: {
                in: checklistItemIds,
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
            },
          })
        : Promise.resolve([]),
    ]);

    const cardMap = new Map(
      existingCards.map((card) => [
        card.id,
        {
          title: card.title,
          isArchived: card.archivedAt !== null || card.list.archivedAt !== null,
        },
      ]),
    );
    const existingListIds = new Set(lists.map((list) => list.id));
    const existingChecklistIds = new Set(checklists.map((checklist) => checklist.id));
    const existingChecklistItemIds = new Set(checklistItems.map((item) => item.id));
    const memberNames = Array.from(
      new Set([
        ...auditLogs.map((log) => log.userName),
        ...boardMembers.map((member) => member.userName),
      ]),
    ).filter(Boolean);

    return NextResponse.json({
      items: auditLogs.map((log) => {
        const resolvedCardId = log.cardId || (log.entityType === "CARD" ? log.entityId : null);
        const cardInfo = resolvedCardId ? cardMap.get(resolvedCardId) : undefined;

        return {
          ...log,
          cardTitle: cardInfo?.title,
          cardArchived: cardInfo?.isArchived ?? false,
          listExists: log.entityType === "LIST" ? existingListIds.has(log.entityId) : true,
          checklistExists: log.entityType === "CHECKLIST" ? existingChecklistIds.has(log.entityId) : true,
          checklistItemExists: log.entityType === "CHECKLIST_ITEM" ? existingChecklistItemIds.has(log.entityId) : true,
        };
      }),
      memberNames,
      page,
      hasMore,
      nextPage: hasMore ? page + 1 : null,
    });
  } catch (error) {
    console.error("[BOARD_ACTIVITY_GET_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
