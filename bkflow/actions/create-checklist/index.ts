"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { ACTION, AUDIT_EVENT_TYPE, ENTITY_TYPE } from "@prisma/client";

import { db } from "@/lib/db";
import { createSafeAction } from "@/lib/create-safe-action";
import { requireBoardMember } from "@/lib/permissions";
import { createAuditLog } from "@/lib/create-audit-log";
import { triggerChecklistCreated } from "@/lib/boards/realtime";

import { CreateChecklist } from "./schema";
import { InputType, ReturnType } from "./types";

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId, orgId } = await auth();

  if (!userId || !orgId) {
    return {
      error: "Không có quyền truy cập.",
    };
  }

  const { boardId, cardId, title, copyFromChecklistId } = data;

  try {
    const permission = await requireBoardMember({ boardId, orgId, userId });

    if (permission.error) {
      return { error: permission.error };
    }

    const card = await db.card.findUnique({
      where: {
        id: cardId,
        list: {
          board: {
            id: boardId,
            orgId,
          },
        },
      },
    });

    if (!card) {
      return { error: "Không tìm thấy thẻ." };
    }

    const lastChecklist = await db.checklist.findFirst({
      where: {
        cardId,
      },
      orderBy: {
        order: "desc",
      },
      select: {
        order: true,
      },
    });

    const checklist = await db.checklist.create({
      data: {
        cardId,
        title,
        order: lastChecklist ? lastChecklist.order + 1 : 0,
      },
    });

    if (copyFromChecklistId) {
      const sourceItems = await db.checklistItem.findMany({
        where: {
          checklistId: copyFromChecklistId,
          checklist: {
            card: {
              list: {
                board: {
                  id: boardId,
                  orgId,
                },
              },
            },
          },
        },
        orderBy: {
          order: "asc",
        },
      });

      if (sourceItems.length > 0) {
        await db.checklistItem.createMany({
          data: sourceItems.map((item, index) => ({
            checklistId: checklist.id,
            title: item.title,
            isCompleted: false,
            order: index,
          })),
        });
      }
    }

    await createAuditLog({
      entityId: checklist.id,
      entityTitle: `detail:đã thêm danh sách công việc ${title} vào thẻ này`,
      entityType: ENTITY_TYPE.CHECKLIST,
      action: ACTION.UPDATE,
      eventType: AUDIT_EVENT_TYPE.CHECKLIST,
      boardId,
      cardId: card.id,
    });

    await triggerChecklistCreated({
      boardId,
      cardId: card.id,
      checklistId: checklist.id,
      actorUserId: userId,
      includeLogs: true,
    });

    revalidatePath(`/board/${boardId}`);
    return { data: checklist };
  } catch (error) {
    console.error("[CREATE_CHECKLIST_ERROR]", error);
    return {
      error: "Tạo danh sách việc cần làm thất bại.",
    };
  }
};

export const createChecklist = createSafeAction(CreateChecklist, handler);
