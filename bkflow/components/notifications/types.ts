import { NOTIFICATION_TYPE } from "@prisma/client";

export interface NotificationItem {
  id: string;
  orgId: string;
  recipientUserId: string;
  actorUserId: string | null;
  actorName: string | null;
  actorImage: string | null;
  type: NOTIFICATION_TYPE;
  title: string;
  message: string;
  boardId: string | null;
  boardTitle: string | null;
  cardId: string | null;
  cardTitle: string | null;
  listTitle: string | null;
  commentId: string | null;
  dueDate: string | null;
  triggerTime: string | null;
  reminderLabel: string | null;
  dedupeKey: string | null;
  readAt: string | null;
  createdAt: string;
  updatedAt: string;
}
