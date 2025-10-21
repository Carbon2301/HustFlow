import { auth } from "@clerk/nextjs/server"; 
import { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
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

    const card = await db.card.findUnique({
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
    });

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

    const boardMembers = await db.boardMember.findMany({
      where: {
        boardId: card.list.boardId,
      },
    });

    const boardLabels = await db.label.findMany({
      where: {
        boardId: card.list.boardId,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    const boardChecklists = await db.checklist.findMany({
      where: {
        card: {
          list: {
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
    });

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
