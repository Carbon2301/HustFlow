"use server";

import { auth } from "@clerk/nextjs/server";
import { ACTION, ENTITY_TYPE } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { createAuditLog } from "@/lib/create-audit-log";
import { createSafeAction } from "@/lib/create-safe-action";
import { db } from "@/lib/db";
import { getChecklistAccess } from "@/lib/checklist-access";
import { triggerChecklistUpdated } from "@/lib/boards/realtime";

import { UpdateChecklist } from "./schema";
import { InputType, ReturnType } from "./types";

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId, orgId } = await auth();

  if (!userId || !orgId) {
    return { error: "Không có quyền truy cập." };
  }

  const { boardId, cardId, id, title } = data;

  try {
    const access = await getChecklistAccess({
      boardId,
      cardId,
      checklistId: id,
      orgId,
      userId,
    });

    if (access.error || !access.checklist) {
      return { error: access.error || "Không tìm thấy danh sách công việc." };
    }

    if (access.checklist.title === title) {
      return { data: access.checklist };
    }

    const checklist = await db.checklist.update({
      where: {
        id,
      },
      data: {
        title,
      },
    });

    await createAuditLog({
      entityId: checklist.id,
      entityTitle: `detail:đã đổi tên danh sách công việc thành "${title}"`,
      entityType: ENTITY_TYPE.CHECKLIST,
      action: ACTION.UPDATE,
      boardId,
      cardId,
    });

    await triggerChecklistUpdated({
      boardId: access.checklist.card.list.boardId,
      cardId: access.checklist.cardId,
      checklistId: checklist.id,
      actorUserId: userId,
      includeLogs: true,
    });

    revalidatePath(`/board/${boardId}`);
    return { data: checklist };
  } catch (error) {
    console.error("[UPDATE_CHECKLIST_ERROR]", error);
    return { error: "Cập nhật danh sách công việc thất bại." };
  }
};

export const updateChecklist = createSafeAction(UpdateChecklist, handler);
