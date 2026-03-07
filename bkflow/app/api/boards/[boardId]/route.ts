import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { requireBoardMember } from "@/lib/permissions";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ boardId: string }> },
) {
  try {
    const { boardId } = await params;
    const { userId, orgId } = await auth();

    if (!userId || !orgId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const board = await db.board.findFirst({
      where: {
        id: boardId,
        orgId,
      },
      select: {
        id: true,
        title: true,
      },
    });

    if (!board) {
      return new NextResponse("Not Found", { status: 404 });
    }

    const permission = await requireBoardMember({ boardId, orgId, userId });

    if (permission.error) {
      return new NextResponse(permission.error, { status: 403 });
    }

    return NextResponse.json(board);
  } catch (error) {
    console.error("[BOARD_GET_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
