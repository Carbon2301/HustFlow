import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { ensureDueReminderNotifications } from "@/lib/notifications/reminder-notifications";

export async function GET() {
  try {
    const { userId, orgId } = await auth();

    if (!userId || !orgId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    await ensureDueReminderNotifications({ userId, orgId });

    const notifications = await db.notification.findMany({
      where: {
        orgId,
        recipientUserId: userId,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 50,
    });

    return NextResponse.json(notifications);
  } catch (error) {
    logger.error("[NOTIFICATIONS_GET_ERROR]", error, {
      route: "/api/notifications",
      action: "notifications-get",
    });

    return new NextResponse("Internal Error", { status: 500 });
  }
}
