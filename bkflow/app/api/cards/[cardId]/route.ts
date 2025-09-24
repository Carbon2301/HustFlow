import { auth } from "@clerk/nextjs/server"; 
import { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";

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
        assignees: {
          include: {
            boardMember: true,
          },
          orderBy: {
            createdAt: "asc",
          },
        },
        list: {
          select: {
            title: true,
            board: {
              select: {
                members: {
                  orderBy: {
                    createdAt: "asc",
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!card) {
      return new NextResponse("Not Found", { status: 404 });
    }

    const { list, ...cardData } = card;

    return NextResponse.json({
      ...cardData,
      list: {
        title: list.title,
      },
      boardMembers: list.board.members,
    });
  } catch {
    return new NextResponse("Internal Error", { status: 500 });
  }
}
