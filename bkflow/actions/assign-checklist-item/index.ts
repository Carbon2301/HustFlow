"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { ACTION, ENTITY_TYPE, NOTIFICATION_TYPE } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { createAuditLog } from "@/lib/create-audit-log";
import { createNotification } from "@/lib/create-notification";
import { createSafeAction } from "@/lib/create-safe-action";
import { db } from "@/lib/db";
import { getChecklistItemAccess } from "@/lib/checklist-access";
import { triggerChecklistItemAssigneeUpdated } from "@/lib/boards/realtime";

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

    if ((access.item.assigneeId ?? null) === assigneeId) {
      return { data: access.item };
    }

    const item = await db.checklistItem.update({
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

    let entityTitle = `detail:đã bỏ giao "${access.item.title}"`;
    if (nextAssignee && access.item.assignee) {
      entityTitle = `detail:đã đổi người phụ trách "${access.item.title}" từ ${access.item.assignee.userName} sang ${nextAssignee.userName}`;
    } else if (nextAssignee) {
      entityTitle = `detail:đã giao "${access.item.title}" cho ${nextAssignee.userName}`;
    }

    await createAuditLog({
      entityId: item.id,
      entityTitle,
      entityType: ENTITY_TYPE.CHECKLIST_ITEM,
      action: ACTION.UPDATE,
      cardId,
    });

    await db.notification.deleteMany({
      where: {
        dedupeKey,
        readAt: null,
      },
    });

    if (nextAssignee) {
      await createNotification({
        orgId,
        recipientUserId: nextAssignee.userId,
        actor: {
          userId,
          name: actorName,
          image: user.imageUrl,
        },
        type: NOTIFICATION_TYPE.CHECKLIST_ITEM_ASSIGNED,
        title: "Bạn được giao một việc cần làm",
        message: `${actorName} đã giao mục "${access.item.title}" trong thẻ "${card.title}" cho bạn.`,
        boardId: list.boardId,
        boardTitle: list.board.title,
        cardId: card.id,
        cardTitle: card.title,
        listTitle: list.title,
        dedupeKey,
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
    return { data: item };
  } catch (error) {
    console.error("[ASSIGN_CHECKLIST_ITEM_ERROR]", error);
    return { error: "Cập nhật người phụ trách thất bại." };
  }
};

export const assignChecklistItem = createSafeAction(AssignChecklistItem, handler);
