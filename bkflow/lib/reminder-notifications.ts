import { NOTIFICATION_TYPE } from "@prisma/client";

import { createNotification } from "@/lib/create-notification";
import { db } from "@/lib/db";

export const reminderLabels: Record<string, string> = {
  "0": "Vao ngay thoi diem het han",
  "5": "5 phut truoc",
  "10": "10 phut truoc",
  "15": "15 phut truoc",
  "30": "30 phut truoc",
  "60": "1 gio truoc",
  "120": "2 gio truoc",
  "1440": "1 ngay truoc",
  "2880": "2 ngay truoc",
  "10080": "1 tuan truoc",
  "20160": "2 tuan truoc",
};

const getReminderDedupeKey = ({
  recipientUserId,
  cardId,
  reminder,
  reminderSetAt,
}: {
  recipientUserId: string;
  cardId: string;
  reminder: string;
  reminderSetAt: Date | null;
}) => {
  const reminderSetAtKey = reminderSetAt
    ? new Date(reminderSetAt).getTime()
    : "reminder";

  return `card-reminder:${recipientUserId}:${cardId}:${reminder}:${reminderSetAtKey}`;
};

export const deleteCardReminderNotifications = async (cardId: string) => {
  await db.notification.deleteMany({
    where: {
      cardId,
      type: NOTIFICATION_TYPE.CARD_REMINDER,
    },
  });
};

export const ensureDueReminderNotifications = async ({
  userId,
  orgId,
}: {
  userId: string;
  orgId: string;
}) => {
  const cards = await db.card.findMany({
    where: {
      archivedAt: null,
      list: {
        archivedAt: null,
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
      assignees: {
        some: {
          boardMember: {
            userId,
          },
        },
      },
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
              id: true,
              title: true,
            },
          },
        },
      },
    },
  });

  const now = Date.now();

  await Promise.all(
    cards.map(async (card) => {
      if (!card.dueDate || !card.reminder) {
        return;
      }

      const offsetMinutes = parseInt(card.reminder, 10);
      if (Number.isNaN(offsetMinutes)) {
        return;
      }

      const dueDate = new Date(card.dueDate);
      const triggerTime = new Date(dueDate.getTime() - offsetMinutes * 60 * 1000);

      if (
        card.reminderSetAt &&
        triggerTime.getTime() < new Date(card.reminderSetAt).getTime()
      ) {
        return;
      }

      if (now < triggerTime.getTime()) {
        return;
      }

      await createNotification({
        orgId,
        recipientUserId: userId,
        type: NOTIFICATION_TYPE.CARD_REMINDER,
        title: "Sap den han",
        message: `Task "${card.title}" se het han theo moc nhac nho da thiet lap.`,
        boardId: card.list.board.id,
        boardTitle: card.list.board.title,
        cardId: card.id,
        cardTitle: card.title,
        listTitle: card.list.title,
        dueDate,
        triggerTime,
        reminderLabel: reminderLabels[card.reminder] || "",
        dedupeKey: getReminderDedupeKey({
          recipientUserId: userId,
          cardId: card.id,
          reminder: card.reminder,
          reminderSetAt: card.reminderSetAt,
        }),
      });
    }),
  );
};
