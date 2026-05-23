import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
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
    console.error("[NOTIFICATIONS_GET_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
