import { auth } from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ENTITY_TYPE } from "@prisma/client";

import { db } from "@/lib/db";
import { requireBoardMember } from "@/lib/permissions";

export async function GET(
  request: NextRequest,
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
      select: {
        list: {
          select: {
            boardId: true,
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

    const auditLogs = await db.auditLog.findMany({
      where: {
        orgId,
        entityId: cardId,
        entityType: ENTITY_TYPE.CARD,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 30,
    });

    return NextResponse.json(auditLogs);
  } catch {
    return new NextResponse("Internal Error", { status: 500 });
  }
}
