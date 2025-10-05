import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { requireBoardMember } from "@/lib/permissions";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ cardId: string }> },
) {
  try {
    const { cardId } = await params;
    const { userId, orgId } = await auth();

    if (!userId || !orgId) {
      return new NextResponse("Không có quyền truy cập.", { status: 401 });
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
      select: {
        id: true,
        list: {
          select: {
            boardId: true,
          },
        },
      },
    });

    if (!card) {
      return new NextResponse("Không tìm thấy thẻ.", { status: 404 });
    }

    const permission = await requireBoardMember({
      boardId: card.list.boardId,
      orgId,
      userId,
    });

    if (permission.error) {
      return new NextResponse(permission.error, { status: 403 });
    }

    const comments = await db.cardComment.findMany({
      where: {
        cardId,
        parentId: null,
      },
      include: {
        reactions: {
          orderBy: {
            createdAt: "asc",
          },
        },
        replies: {
          include: {
            reactions: {
              orderBy: {
                createdAt: "asc",
              },
            },
          },
          orderBy: {
            createdAt: "asc",
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(comments);
  } catch {
    return new NextResponse("Lỗi máy chủ.", { status: 500 });
  }
}
