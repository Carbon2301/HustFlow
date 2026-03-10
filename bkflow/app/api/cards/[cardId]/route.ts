import { auth } from "@clerk/nextjs/server"; 
import { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { measureDev } from "@/lib/perf";
import { requireBoardMember } from "@/lib/permissions";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ cardId: string }> }
) {
  try {
    const { cardId } = await params;
    const { userId, orgId } = await auth();

    if (!userId || !orgId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const card = await measureDev(`api:card:${cardId}:detail`, () => db.card.findFirst({
      where: {
        id: cardId,
        list: {
          board: {
            orgId,
          },
        },
      },
      include: {
        list: {
          select: {
            title: true,
            boardId: true,
          },
        },
        assignees: {
          include: {
            boardMember: true,
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
        _count: {
          select: {
            comments: true,
            attachments: true,
          },
        },
        attachments: {
          orderBy: [
            {
              type: "asc",
            },
            {
              order: "asc",
            },
            {
              createdAt: "desc",
            },
          ],
        },
        checklists: {
          include: {
            items: {
              include: {
                assignee: true,
              },
              orderBy: {
                order: "asc",
              },
            },
          },
          orderBy: {
            order: "asc",
          },
        },
      },
    }));

    if (!card) {
      return new NextResponse("Not Found", { status: 404 });
    }

    const permission = await requireBoardMember({
      boardId: card.list.boardId,
      orgId,
      userId,
    });

    if (permission.error) {
      return new NextResponse(permission.error, { status: 403 });
    }

    const [boardMembers, boardLabels, boardChecklists] = await measureDev(
      `api:card:${cardId}:board-related`,
      () => Promise.all([
        db.boardMember.findMany({
          where: {
            boardId: card.list.boardId,
          },
        }),
        db.label.findMany({
          where: {
            boardId: card.list.boardId,
          },
          orderBy: {
            createdAt: "asc",
          },
        }),
        db.checklist.findMany({
          where: {
            card: {
              archivedAt: null,
              list: {
                archivedAt: null,
                boardId: card.list.boardId,
              },
            },
          },
          include: {
            items: {
              include: {
                assignee: true,
              },
              orderBy: {
                order: "asc",
              },
            },
            card: {
              select: {
                title: true,
              },
            },
          },
          orderBy: {
            order: "asc",
          },
        }),
      ]),
    );

    return NextResponse.json({
      ...card,
      boardMembers,
      boardLabels,
      boardChecklists,
    });
  } catch (error) {
    console.error("[CARD_GET_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
