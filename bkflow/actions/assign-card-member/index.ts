"use server";

import { auth } from "@clerk/nextjs/server";
import { ACTION, ENTITY_TYPE } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { createAuditLog } from "@/lib/create-audit-log";
import { createSafeAction } from "@/lib/create-safe-action";
import { db } from "@/lib/db";
import { getOrganizationMember } from "@/lib/clerk-org-members";

import { AssignCardMember } from "./schema";
import { InputType, ReturnType } from "./types";

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId, orgId } = await auth();

  if (!userId || !orgId) {
    return { error: "Không có quyền truy cập." };
  }

  const { boardId, cardId, boardMemberId } = data;
  let cardAssignee;

  try {
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
      select: {
        id: true,
        title: true,
        list: {
          select: {
            boardId: true,
          },
        },
      },
    });

    if (!card) {
      return { error: "Không tìm thấy thẻ." };
    }

    const boardMember = await db.boardMember.findUnique({
      where: {
        id: boardMemberId,
        board: {
          id: boardId,
          orgId,
        },
      },
    });

    if (!boardMember) {
      return { error: "Không tìm thấy thành viên trong bảng." };
    }

    const orgMember = await getOrganizationMember(orgId, boardMember.userId);

    if (!orgMember) {
      return { error: "Người dùng không thuộc tổ chức hiện tại." };
    }

    const existingAssignee = await db.cardAssignee.findUnique({
      where: {
        cardId_boardMemberId: {
          cardId,
          boardMemberId,
        },
      },
      include: {
        boardMember: true,
      },
    });

    if (existingAssignee) {
      return { data: existingAssignee };
    }

    cardAssignee = await db.cardAssignee.create({
      data: {
        cardId,
        boardMemberId,
      },
      include: {
        boardMember: true,
      },
    });

    await createAuditLog({
      entityId: card.id,
      entityTitle: `detail:đã giao ${boardMember.userName} cho thẻ "${card.title}"`,
      entityType: ENTITY_TYPE.CARD,
      action: ACTION.UPDATE,
    });
  } catch {
    return { error: "Giao thành viên cho thẻ thất bại." };
  }

  revalidatePath(`/board/${boardId}`);
  return { data: cardAssignee };
};

export const assignCardMember = createSafeAction(AssignCardMember, handler);
