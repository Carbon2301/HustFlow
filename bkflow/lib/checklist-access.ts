import { ChecklistItem } from "@prisma/client";

import { db } from "@/lib/db";
import { requireBoardEditor } from "@/lib/permissions";

type ChecklistAccessInput = {
  boardId: string;
  checklistId: string;
  orgId: string;
  userId: string;
  cardId?: string;
};

type ChecklistItemAccessInput = {
  boardId: string;
  itemId: string;
  orgId: string;
  userId: string;
  cardId?: string;
};

type ChecklistItemOrderInput = Pick<ChecklistItem, "id" | "order">;

type ChecklistItemMoveInput = {
  boardId: string;
  cardId: string;
  sourceChecklistId: string;
  destinationChecklistId: string;
  itemId: string;
  orgId: string;
  userId: string;
  sourceItems: ChecklistItemOrderInput[];
  destinationItems: ChecklistItemOrderInput[];
};

const idsMatch = (actualIds: string[], payloadIds: string[]) => {
  if (actualIds.length !== payloadIds.length) {
    return false;
  }

  const payloadIdSet = new Set(payloadIds);

  return actualIds.every((id) => payloadIdSet.has(id));
};

export const getChecklistAccess = async ({
  boardId,
  checklistId,
  orgId,
  userId,
  cardId,
}: ChecklistAccessInput) => {
  const permission = await requireBoardEditor({ boardId, orgId, userId });

  if (permission.error) {
    return { error: permission.error, checklist: null };
  }

  const checklist = await db.checklist.findFirst({
    where: {
      id: checklistId,
      ...(cardId ? { cardId } : {}),
      card: {
        list: {
          board: {
            id: boardId,
            orgId,
          },
        },
      },
    },
    include: {
      card: {
        include: {
          list: {
            select: {
              id: true,
              title: true,
              boardId: true,
              board: {
                select: {
                  id: true,
                  title: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!checklist) {
    return { error: "Không tìm thấy danh sách công việc.", checklist: null };
  }

  return { error: null, checklist };
};

export const getChecklistItemAccess = async ({
  boardId,
  itemId,
  orgId,
  userId,
  cardId,
}: ChecklistItemAccessInput) => {
  const permission = await requireBoardEditor({ boardId, orgId, userId });

  if (permission.error) {
    return { error: permission.error, item: null };
  }

  const item = await db.checklistItem.findFirst({
    where: {
      id: itemId,
      checklist: {
        ...(cardId ? { cardId } : {}),
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
    include: {
      assignee: true,
      checklist: {
        include: {
          card: {
            include: {
              list: {
                select: {
                  id: true,
                  title: true,
                  boardId: true,
                  board: {
                    select: {
                      id: true,
                      title: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!item) {
    return { error: "Không tìm thấy mục công việc.", item: null };
  }

  return { error: null, item };
};

export const validateChecklistItemsForReorder = async ({
  boardId,
  cardId,
  checklistId,
  orgId,
  userId,
  items,
}: ChecklistAccessInput & { items: ChecklistItemOrderInput[] }) => {
  const access = await getChecklistAccess({
    boardId,
    checklistId,
    orgId,
    userId,
    cardId,
  });

  if (access.error || !access.checklist) {
    return { error: access.error, checklist: null };
  }

  const existingItemCount = await db.checklistItem.count({
    where: {
      id: {
        in: items.map((item) => item.id),
      },
      checklistId,
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
  });

  if (existingItemCount !== items.length) {
    return {
      error: "Không thể sắp xếp mục công việc không thuộc danh sách này.",
      checklist: null,
    };
  }

  return { error: null, checklist: access.checklist };
};

export const validateChecklistItemMove = async ({
  boardId,
  cardId,
  sourceChecklistId,
  destinationChecklistId,
  itemId,
  orgId,
  userId,
  sourceItems,
  destinationItems,
}: ChecklistItemMoveInput) => {
  if (sourceChecklistId === destinationChecklistId) {
    return {
      error: "Hãy sử dụng sắp xếp trong cùng danh sách cho thao tác này.",
      sourceChecklist: null,
      destinationChecklist: null,
    };
  }

  const permission = await requireBoardEditor({ boardId, orgId, userId });

  if (permission.error) {
    return {
      error: permission.error,
      sourceChecklist: null,
      destinationChecklist: null,
    };
  }

  const checklists = await db.checklist.findMany({
    where: {
      id: {
        in: [sourceChecklistId, destinationChecklistId],
      },
      cardId,
      card: {
        list: {
          board: {
            id: boardId,
            orgId,
          },
        },
      },
    },
    include: {
      card: {
        include: {
          list: {
            select: {
              id: true,
              title: true,
              boardId: true,
              board: {
                select: {
                  id: true,
                  title: true,
                },
              },
            },
          },
        },
      },
      items: {
        select: {
          id: true,
        },
        orderBy: {
          order: "asc",
        },
      },
    },
  });

  const sourceChecklist = checklists.find((checklist) => checklist.id === sourceChecklistId) ?? null;
  const destinationChecklist = checklists.find((checklist) => checklist.id === destinationChecklistId) ?? null;

  if (!sourceChecklist || !destinationChecklist) {
    return {
      error: "Không tìm thấy danh sách công việc hợp lệ.",
      sourceChecklist: null,
      destinationChecklist: null,
    };
  }

  const sourceCurrentIds = sourceChecklist.items.map((item) => item.id);
  const destinationCurrentIds = destinationChecklist.items.map((item) => item.id);

  if (!sourceCurrentIds.includes(itemId)) {
    return {
      error: "Mục công việc không còn thuộc danh sách nguồn.",
      sourceChecklist: null,
      destinationChecklist: null,
    };
  }

  const sourcePayloadIds = sourceItems.map((item) => item.id);
  const destinationPayloadIds = destinationItems.map((item) => item.id);
  const combinedPayloadIds = [...sourcePayloadIds, ...destinationPayloadIds];

  if (new Set(combinedPayloadIds).size !== combinedPayloadIds.length) {
    return {
      error: "Danh sách sắp xếp không hợp lệ.",
      sourceChecklist: null,
      destinationChecklist: null,
    };
  }

  if (sourcePayloadIds.includes(itemId) || !destinationPayloadIds.includes(itemId)) {
    return {
      error: "Mục công việc di chuyển không nằm đúng danh sách đích.",
      sourceChecklist: null,
      destinationChecklist: null,
    };
  }

  const expectedSourceIds = sourceCurrentIds.filter((id) => id !== itemId);
  const expectedDestinationIds = [...destinationCurrentIds, itemId];

  if (
    !idsMatch(expectedSourceIds, sourcePayloadIds) ||
    !idsMatch(expectedDestinationIds, destinationPayloadIds)
  ) {
    return {
      error: "Không thể di chuyển với dữ liệu sắp xếp đã cũ.",
      sourceChecklist: null,
      destinationChecklist: null,
    };
  }

  return {
    error: null,
    sourceChecklist,
    destinationChecklist,
  };
};
