import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { requireBoardMember } from "@/lib/permissions";

const isArchivedType = (value: string | null): value is "lists" | "cards" =>
  value === "lists" || value === "cards";

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

    const type = request.nextUrl.searchParams.get("type");

    if (!isArchivedType(type)) {
      return NextResponse.json(
        { error: "Invalid archived item type." },
        { status: 400 },
      );
    }

    const permission = await requireBoardMember({ boardId, orgId, userId });

    if (permission.error) {
      return new NextResponse(permission.error, { status: 403 });
    }

    const query = request.nextUrl.searchParams.get("q")?.trim();
    const titleFilter = query
      ? {
          title: {
            contains: query,
          },
        }
      : {};

    if (type === "lists") {
      const lists = await db.list.findMany({
        where: {
          boardId,
          archivedAt: {
            not: null,
          },
          ...titleFilter,
          board: {
            orgId,
          },
        },
        select: {
          id: true,
          title: true,
          boardId: true,
          archivedAt: true,
          _count: {
            select: {
              cards: true,
            },
          },
        },
        orderBy: [
          {
            archivedAt: "desc",
          },
          {
            updatedAt: "desc",
          },
        ],
      });

      return NextResponse.json({ items: lists });
    }

    const cards = await db.card.findMany({
      where: {
        archivedAt: {
          not: null,
        },
        ...titleFilter,
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
        listId: true,
        archivedAt: true,
        list: {
          select: {
            title: true,
            archivedAt: true,
            boardId: true,
          },
        },
      },
      orderBy: [
        {
          archivedAt: "desc",
        },
        {
          updatedAt: "desc",
        },
      ],
    });

    return NextResponse.json({
      items: cards.map((card) => ({
        id: card.id,
        title: card.title,
        listId: card.listId,
        listTitle: card.list.title,
        boardId: card.list.boardId,
        archivedAt: card.archivedAt,
        listArchivedAt: card.list.archivedAt,
      })),
    });
  } catch (error) {
    console.error("[BOARD_ARCHIVED_GET_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
