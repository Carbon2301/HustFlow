import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

export async function PATCH() {
  try {
    const { userId, orgId } = await auth();

    if (!userId || !orgId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const boardMemberships = await db.boardMember.findMany({
      where: {
        userId,
        board: {
          orgId,
        },
      },
      select: {
        boardId: true,
      },
    });
    const boardIds = boardMemberships.map((membership) => membership.boardId);

    await db.notification.updateMany({
      where: {
        orgId,
        recipientUserId: userId,
        readAt: null,
        OR: [
          { boardId: null },
          {
            boardId: {
              in: boardIds,
            },
          },
        ],
      },
      data: {
        readAt: new Date(),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error("[NOTIFICATIONS_READ_ALL_ERROR]", error, {
      route: "/api/notifications/read-all",
      action: "notifications-read-all",
    });

    return new NextResponse("Internal Error", { status: 500 });
  }
}
