"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import {
  ACTION,
  AUDIT_EVENT_TYPE,
  ENTITY_TYPE,
  NOTIFICATION_TYPE,
  type BoardMember,
  type CardAssignee,
  type ChecklistItem,
  type Notification,
} from "@prisma/client";
import { revalidatePath } from "next/cache";

import { createSafeAction } from "@/lib/create-safe-action";
import { db } from "@/lib/db";
import { isAssignableBoardMember } from "@/lib/boards/board-member-role";
import { getChecklistItemAccess } from "@/lib/checklists/checklist-access";
import { triggerChecklistItemAssigneeUpdated } from "@/lib/boards/realtime";
import { triggerCardMemberAssigned } from "@/lib/cards/realtime";
import { triggerNotificationCreated } from "@/lib/notifications/realtime";

import { AssignChecklistItem } from "./schema";
import { InputType, ReturnType } from "./types";

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId, orgId } = await auth();
  const user = await currentUser();

  if (!userId || !orgId || !user) {
    return { error: "Không có quyền truy cập." };
  }

  const { boardId, cardId, id, assigneeId } = data;

  try {
    const access = await getChecklistItemAccess({
      boardId,
      cardId,
      itemId: id,
      orgId,
      userId,
    });

    if (access.error || !access.item) {
      return { error: access.error || "Không tìm thấy mục công việc." };
    }

    const card = access.item.checklist.card;
    const list = card.list;
    const dedupeKey = `checklist-item-assigned:${id}`;
    const actorName = user.fullName || user.username || user.primaryEmailAddress?.emailAddress || "Thành viên";
    const logUserName = user.fullName || `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || "Thành viên";
    const nextAssignee = assigneeId
      ? await db.boardMember.findFirst({
          where: {
            id: assigneeId,
            boardId: list.boardId,
            board: {
              orgId,
            },
          },
        })
      : null;

    if (assigneeId && !nextAssignee) {
      return { error: "Người được giao phải thuộc cùng bảng." };
    }

    if (nextAssignee && !isAssignableBoardMember(nextAssignee)) {
      return { error: "Khách chỉ có quyền xem và không thể được giao checklist." };
    }

    if ((access.item.assigneeId ?? null) === assigneeId) {
      return { data: { item: access.item, cardMemberAdded: false } };
    }

    let cardMemberAdded = false;
    let cardAssigneeAdded: (CardAssignee & { boardMember: BoardMember }) | null = null;
    let item: ChecklistItem & { assignee: BoardMember | null } = access.item;
    const createdNotifications: Notification[] = [];

    await db.$transaction(async (tx) => {
      // 1. If assigneeId exists, check whether this user is already assigned to the parent card.
      if (nextAssignee) {
        const existingCardAssignee = await tx.cardAssignee.findUnique({
          where: {
            cardId_boardMemberId: {
              cardId,
              boardMemberId: nextAssignee.id,
            },
          },
        });

        if (!existingCardAssignee) {
          cardAssigneeAdded = await tx.cardAssignee.create({
            data: {
              cardId,
              boardMemberId: nextAssignee.id,
            },
            include: {
              boardMember: true,
            },
          });
          cardMemberAdded = true;

          // Create notification for card assignment inside the transaction
          if (nextAssignee.userId !== userId) {
            const notif = await tx.notification.create({
              data: {
                orgId,
                recipientUserId: nextAssignee.userId,
                actorUserId: userId,
                actorName,
                actorImage: user.imageUrl,
                type: NOTIFICATION_TYPE.CARD_ASSIGNED,
                title: "Bạn được giao một thẻ",
                message: `Bạn đã được tự động thêm vào thẻ "${card.title}" do được giao việc cần làm.`,
                boardId: list.boardId,
                boardTitle: list.board.title,
                cardId: card.id,
                cardTitle: card.title,
                listTitle: list.title,
              },
            });
            createdNotifications.push(notif);
          }

          // Create audit log for card auto-add inside the transaction
          await tx.auditLog.create({
            data: {
              orgId,
              boardId: list.boardId,
              cardId,
              entityId: card.id,
              entityType: ENTITY_TYPE.CARD,
              entityTitle: `detail:đã tự động thêm ${nextAssignee.userName} vào thẻ "${card.title}"`,
              action: ACTION.UPDATE,
              eventType: AUDIT_EVENT_TYPE.ASSIGN_MEMBER,
              userId: user.id,
              userImage: user.imageUrl,
              userName: logUserName,
            },
          });
        }
      }

      // 2. Update checklist item
      item = await tx.checklistItem.update({
        where: {
          id,
        },
        data: {
          assigneeId,
        },
        include: {
          assignee: true,
        },
      });

      // 3. Create audit log for checklist item assignment
      let entityTitle = `detail:đã bỏ giao mục công việc "${access.item.title}" ở thẻ "${card.title}"`;
      if (nextAssignee && access.item.assignee) {
        entityTitle = `detail:đã đổi người phụ trách mục công việc "${access.item.title}" từ ${access.item.assignee.userName} sang ${nextAssignee.userName} ở thẻ "${card.title}"`;
      } else if (nextAssignee) {
        entityTitle = `detail:đã giao ${nextAssignee.userName} cho mục công việc "${access.item.title}" ở thẻ "${card.title}"`;
      }

      await tx.auditLog.create({
        data: {
          orgId,
          boardId: list.boardId,
          cardId,
          entityId: item.id,
          entityType: ENTITY_TYPE.CHECKLIST_ITEM,
          entityTitle,
          action: ACTION.UPDATE,
          eventType: AUDIT_EVENT_TYPE.CHECKLIST,
          userId: user.id,
          userImage: user.imageUrl,
          userName: logUserName,
        },
      });

      // 4. Handle notification for checklist item assignment
      await tx.notification.deleteMany({
        where: {
          dedupeKey,
          readAt: null,
        },
      });

      if (nextAssignee && nextAssignee.userId !== userId) {
        // Check dedupeKey inside transaction
        const existingUnreadNotification = await tx.notification.findFirst({
          where: {
            dedupeKey,
            readAt: null,
          },
          select: {
            id: true,
          },
        });

        if (!existingUnreadNotification) {
          const notif = await tx.notification.create({
            data: {
              orgId,
              recipientUserId: nextAssignee.userId,
              actorUserId: userId,
              actorName,
              actorImage: user.imageUrl,
              type: NOTIFICATION_TYPE.CHECKLIST_ITEM_ASSIGNED,
              title: "Bạn được giao một việc cần làm",
              message: `${actorName} đã giao mục "${access.item.title}" trong thẻ "${card.title}" cho bạn.`,
              boardId: list.boardId,
              boardTitle: list.board.title,
              cardId: card.id,
              cardTitle: card.title,
              listTitle: list.title,
              dedupeKey,
            },
          });
          createdNotifications.push(notif);
        }
      }
    });

    // 5. Trigger notifications realtime event AFTER transaction succeeds
    for (const notif of createdNotifications) {
      await triggerNotificationCreated(notif);
    }

    // 6. Trigger other realtime events after transaction succeeds
    if (cardAssigneeAdded) {
      await triggerCardMemberAssigned({
        boardId,
        cardId: card.id,
        actorUserId: userId,
        assignee: cardAssigneeAdded,
      });
    }

    await triggerChecklistItemAssigneeUpdated({
      boardId: list.boardId,
      cardId: card.id,
      checklistId: access.item.checklistId,
      checklistItemId: item.id,
      actorUserId: userId,
      assigneeId: item.assigneeId,
      includeLogs: true,
    });

    revalidatePath(`/board/${boardId}`);
    return { data: { item, cardMemberAdded } };
  } catch (error) {
    console.error("[ASSIGN_CHECKLIST_ITEM_ERROR]", error);
    return { error: "Cập nhật người phụ trách thất bại." };
  }
};

export const assignChecklistItem = createSafeAction(AssignChecklistItem, handler);
