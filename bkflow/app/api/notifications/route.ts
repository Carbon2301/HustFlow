import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const { userId, orgId } = await auth();

    if (!userId || !orgId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const cards = await db.card.findMany({
      where: {
        list: {
          board: {
            orgId,
          },
        },
        dueDate: {
          not: null,
        },
        reminder: {
          not: null,
          notIn: ["none"],
        },
        isCompleted: false,
      },
      select: {
        id: true,
        title: true,
        dueDate: true,
        reminder: true,
        reminderSetAt: true,
        list: {
          select: {
            title: true,
            board: {
              select: {
                title: true,
              },
            },
          },
        },
      },
    });

    const now = new Date();
    const notifications = [];

    const reminderLabels: Record<string, string> = {
      "0": "Vào ngày thời điểm hết hạn",
      "5": "5 phút trước",
      "10": "10 phút trước",
      "15": "15 phút trước",
      "30": "30 phút trước",
      "60": "1 giờ trước",
      "120": "2 giờ trước",
      "1440": "1 ngày trước",
      "2880": "2 ngày trước",
      "10080": "1 tuần trước",
      "20160": "2 tuần trước",
    };

    for (const card of cards) {
      if (!card.dueDate || !card.reminder) continue;

      const offsetMinutes = parseInt(card.reminder, 10);
      if (isNaN(offsetMinutes)) continue;

      const dueDateMs = new Date(card.dueDate).getTime();
      const triggerTimeMs = dueDateMs - offsetMinutes * 60 * 1000;

      // Layer 2: triggerTime must be >= reminderSetAt (reminder was valid when set)
      if (card.reminderSetAt && triggerTimeMs < new Date(card.reminderSetAt).getTime()) {
        continue; // Skip: trigger was already in the past when reminder was configured
      }

      if (now.getTime() >= triggerTimeMs) {
        const reminderSetTime = card.reminderSetAt
          ? new Date(card.reminderSetAt).getTime()
          : "reminder";

        notifications.push({
          id: `${card.id}-${reminderSetTime}`,
          cardId: card.id,
          cardTitle: card.title,
          dueDate: new Date(card.dueDate).toISOString(),
          boardTitle: card.list.board.title,
          listTitle: card.list.title,
          reminderLabel: reminderLabels[card.reminder] || "",
          triggerTime: new Date(triggerTimeMs).toISOString(),
        });
      }
    }

    notifications.sort(
      (a, b) =>
        new Date(b.triggerTime).getTime() - new Date(a.triggerTime).getTime()
    );

    return NextResponse.json(notifications);
  } catch (error) {
    console.error("[NOTIFICATIONS_GET_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
