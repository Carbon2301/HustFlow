import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";

export async function PATCH() {
  try {
    const { userId, orgId } = await auth();

    if (!userId || !orgId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    await db.notification.updateMany({
      where: {
        orgId,
        recipientUserId: userId,
        readAt: null,
      },
      data: {
        readAt: new Date(),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[NOTIFICATIONS_READ_ALL_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
