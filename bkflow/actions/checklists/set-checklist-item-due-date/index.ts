"use server";

import { auth } from "@clerk/nextjs/server";
import { ACTION, AUDIT_EVENT_TYPE, ENTITY_TYPE } from "@prisma/client";
import { format } from "date-fns";
import { revalidatePath } from "next/cache";

import { createAuditLog } from "@/lib/create-audit-log";
import { createSafeAction } from "@/lib/create-safe-action";
import { db } from "@/lib/db";
import { getChecklistItemAccess } from "@/lib/checklist-access";
import { triggerChecklistItemDueDateUpdated } from "@/lib/boards/realtime";

import { SetChecklistItemDueDate } from "./schema";
import { InputType, ReturnType } from "./types";

const formatDueDateForLog = (date: Date) => format(date, "dd/MM/yyyy HH:mm");

const getChecklistDueDateRangeError = (cardDueDate: Date) =>
  `Hạn checklist phải trước hoặc bằng hạn chót của thẻ (${formatDueDateForLog(cardDueDate)}).`;

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId, orgId } = await auth();

  if (!userId || !orgId) {
    return { error: "Không có quyền truy cập." };
  }

  const { boardId, cardId, id, dueDate } = data;

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

    const currentTime = access.item.dueDate?.getTime() ?? null;
    const nextTime = dueDate?.getTime() ?? null;

    if (currentTime === nextTime) {
      return { data: access.item };
    }

    const parentCardDueDate = access.item.checklist.card.dueDate;

    if (
      dueDate &&
      parentCardDueDate &&
      dueDate.getTime() > parentCardDueDate.getTime()
    ) {
      return {
        error: getChecklistDueDateRangeError(parentCardDueDate),
      };
    }

    const item = await db.checklistItem.update({
      where: {
        id,
      },
      data: {
        dueDate,
      },
    });

    let entityTitle = `detail:đã xoá ngày hết hạn của "${access.item.title}"`;
    if (dueDate && access.item.dueDate) {
      entityTitle = `detail:đã đổi ngày hết hạn của "${access.item.title}" thành ${formatDueDateForLog(dueDate)}`;
    } else if (dueDate) {
      entityTitle = `detail:đã đặt ngày hết hạn của "${access.item.title}" là ${formatDueDateForLog(dueDate)}`;
    }

    await createAuditLog({
      entityId: item.id,
      entityTitle,
      entityType: ENTITY_TYPE.CHECKLIST_ITEM,
      action: ACTION.UPDATE,
      eventType: AUDIT_EVENT_TYPE.DUE_DATE,
      boardId,
      cardId,
    });

    await triggerChecklistItemDueDateUpdated({
      boardId: access.item.checklist.card.list.boardId,
      cardId: access.item.checklist.cardId,
      checklistId: access.item.checklistId,
      checklistItemId: item.id,
      actorUserId: userId,
      dueDate: item.dueDate,
      includeLogs: true,
    });

    revalidatePath(`/board/${boardId}`);
    return { data: item };
  } catch (error) {
    console.error("[SET_CHECKLIST_ITEM_DUE_DATE_ERROR]", error);
    return { error: "Cập nhật ngày hết hạn thất bại." };
  }
};

export const setChecklistItemDueDate = createSafeAction(SetChecklistItemDueDate, handler);
