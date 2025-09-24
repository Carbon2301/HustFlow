"use server";

import { auth } from "@clerk/nextjs/server";
import { ACTION, ENTITY_TYPE } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { createAuditLog } from "@/lib/create-audit-log";
import { createSafeAction } from "@/lib/create-safe-action";
import { db } from "@/lib/db";

import { UnassignCardMember } from "./schema";
import { InputType, ReturnType } from "./types";

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId, orgId } = await auth();

  if (!userId || !orgId) {
    return { error: "Không có quyền truy cập." };
  }

  const { boardId, cardId, boardMemberId } = data;
  let cardAssignee;

  try {
    cardAssignee = await db.cardAssignee.findUnique({
      where: {
        cardId_boardMemberId: {
          cardId,
          boardMemberId,
        },
        card: {
          list: {
            board: {
              id: boardId,
              orgId,
            },
          },
        },
        boardMember: {
          board: {
            id: boardId,
            orgId,
          },
        },
      },
      include: {
        boardMember: true,
        card: true,
      },
    });

    if (!cardAssignee) {
      return { error: "Không tìm thấy người được giao trong thẻ." };
    }

    await db.cardAssignee.delete({
      where: {
        id: cardAssignee.id,
      },
    });

    await createAuditLog({
      entityId: cardAssignee.card.id,
      entityTitle: `detail:đã bỏ giao ${cardAssignee.boardMember.userName} khỏi thẻ "${cardAssignee.card.title}"`,
      entityType: ENTITY_TYPE.CARD,
      action: ACTION.UPDATE,
    });
  } catch {
    return { error: "Bỏ giao thành viên khỏi thẻ thất bại." };
  }

  revalidatePath(`/board/${boardId}`);
  return { data: cardAssignee };
};

export const unassignCardMember = createSafeAction(UnassignCardMember, handler);
