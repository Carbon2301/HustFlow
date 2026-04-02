"use server";

import { auth } from "@clerk/nextjs/server";
import { ACTION, AUDIT_EVENT_TYPE, ENTITY_TYPE } from "@prisma/client";

import { createAuditLog } from "@/lib/create-audit-log";
import { createSafeAction } from "@/lib/create-safe-action";
import { db } from "@/lib/db";
import { requireBoardEditor } from "@/lib/permissions";

import { CreateCardDependency } from "./schema";
import { InputType, ReturnType } from "./types";

const formatAuditCardMarker = (card: { id: string; title: string }) =>
  `[card:${card.id}|${card.title.replace(/[\[\]|]/g, " ")}]`;

const wouldCreateCycle = async ({
  boardId,
  orgId,
  blockerCardId,
  blockedCardId,
}: {
  boardId: string;
  orgId: string;
  blockerCardId: string;
  blockedCardId: string;
}) => {
  const dependencies = await db.cardDependency.findMany({
    where: {
      blockerCard: {
        list: {
          board: {
            id: boardId,
            orgId,
          },
        },
      },
    },
    select: {
      blockerCardId: true,
      blockedCardId: true,
    },
  });

  const blockedCardsByBlockerId = new Map<string, string[]>();

  for (const dependency of dependencies) {
    const blockedCards = blockedCardsByBlockerId.get(dependency.blockerCardId) ?? [];

    blockedCards.push(dependency.blockedCardId);
    blockedCardsByBlockerId.set(dependency.blockerCardId, blockedCards);
  }

  const queue = [blockedCardId];
  const visited = new Set<string>(queue);

  while (queue.length > 0) {
    const currentCardId = queue.shift()!;

    if (currentCardId === blockerCardId) {
      return true;
    }

    const nextCardIds = blockedCardsByBlockerId.get(currentCardId) ?? [];

    for (const nextCardId of nextCardIds) {
      if (visited.has(nextCardId)) {
        continue;
      }

      visited.add(nextCardId);
      queue.push(nextCardId);
    }
  }

  return false;
};

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId, orgId } = await auth();

  if (!userId || !orgId) {
    return {
      error: "Không có quyền truy cập.",
    };
  }

  const { boardId, blockerCardId, blockedCardId } = data;

  if (blockerCardId === blockedCardId) {
    return {
      error: "Một thẻ không thể phụ thuộc vào chính nó.",
    };
  }

  try {
    const permission = await requireBoardEditor({ boardId, orgId, userId });

    if (permission.error) {
      return { error: permission.error };
    }

    const cards = await db.card.findMany({
      where: {
        id: {
          in: [blockerCardId, blockedCardId],
        },
        archivedAt: null,
        list: {
          archivedAt: null,
          board: {
            id: boardId,
            orgId,
          },
        },
      },
      select: {
        id: true,
        title: true,
      },
    });

    const blockerCard = cards.find((card) => card.id === blockerCardId);
    const blockedCard = cards.find((card) => card.id === blockedCardId);

    if (!blockerCard || !blockedCard) {
      return {
        error: "Không tìm thấy thẻ hoặc thẻ không thuộc bảng này.",
      };
    }

    const existingDependency = await db.cardDependency.findUnique({
      where: {
        blockerCardId_blockedCardId: {
          blockerCardId,
          blockedCardId,
        },
      },
    });

    if (existingDependency) {
      return {
        error: "Liên kết phụ thuộc này đã tồn tại.",
      };
    }

    const createsCycle = await wouldCreateCycle({
      boardId,
      orgId,
      blockerCardId,
      blockedCardId,
    });

    if (createsCycle) {
      return {
        error: "Không thể tạo liên kết phụ thuộc vì sẽ tạo vòng lặp.",
      };
    }

    const dependency = await db.cardDependency.create({
      data: {
        blockerCardId,
        blockedCardId,
      },
    });

    await createAuditLog({
      entityId: dependency.id,
      entityType: ENTITY_TYPE.CARD,
      entityTitle: `detail:đã thiết lập liên kết phụ thuộc: thẻ ${formatAuditCardMarker(blockedCard)} phụ thuộc vào thẻ ${formatAuditCardMarker(blockerCard)}`,
      action: ACTION.UPDATE,
      eventType: AUDIT_EVENT_TYPE.UPDATE,
      boardId,
      cardId: blockedCard.id,
    });

    return { data: dependency };
  } catch (error) {
    console.error("[CREATE_CARD_DEPENDENCY_ERROR]", error);
    return {
      error: "Tạo liên kết phụ thuộc thất bại.",
    };
  }
};

export const createCardDependency = createSafeAction(CreateCardDependency, handler);
