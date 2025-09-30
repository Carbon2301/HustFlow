import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ notificationId: string }> },
) {
  try {
    const { notificationId } = await params;
    const { userId, orgId } = await auth();

    if (!userId || !orgId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const body = await req.json();
    const read = Boolean(body.read);

    const notification = await db.notification.findFirst({
      where: {
        id: notificationId,
        orgId,
        recipientUserId: userId,
      },
      select: {
        id: true,
      },
    });

    if (!notification) {
      return new NextResponse("Not Found", { status: 404 });
    }

    const updatedNotification = await db.notification.update({
      where: {
        id: notification.id,
      },
      data: {
        readAt: read ? new Date() : null,
      },
    });

    return NextResponse.json(updatedNotification);
  } catch (error) {
    console.error("[NOTIFICATION_PATCH_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
