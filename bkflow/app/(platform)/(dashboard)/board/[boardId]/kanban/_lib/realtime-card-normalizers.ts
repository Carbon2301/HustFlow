import type { CardWithAssignees, CardWithList } from "@/types";

export type BoardCardApiResponse = CardWithList & {
  _count?: {
    comments: number;
    attachments: number;
  };
};

export const toDate = (value: Date | string | null | undefined) => {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value : new Date(value);
};

export const normalizeCardForBoard = (card: BoardCardApiResponse): CardWithAssignees => ({
  ...card,
  createdAt: toDate(card.createdAt) ?? new Date(),
  updatedAt: toDate(card.updatedAt) ?? new Date(),
  descriptionUpdatedAt: toDate(card.descriptionUpdatedAt) ?? new Date(),
  startDate: toDate(card.startDate),
  dueDate: toDate(card.dueDate),
  reminderSetAt: toDate(card.reminderSetAt),
  archivedAt: toDate(card.archivedAt),
  assignees: card.assignees ?? [],
  labels: card.labels ?? [],
  checklists: card.checklists?.map((checklist) => ({
    items: checklist.items.map((item) => ({
      isCompleted: item.isCompleted,
    })),
  })) ?? [],
  checklistProgress: {
    total: card.checklists?.reduce((acc, checklist) => acc + checklist.items.length, 0) ?? 0,
    completed: card.checklists?.reduce(
      (acc, checklist) => acc + checklist.items.filter((item) => item.isCompleted).length,
      0,
    ) ?? 0,
  },
  unresolvedBlockerCount: card.blockedByDependencies?.filter(
    (dependency) => !dependency.blockerCard.isCompleted,
  ).length ?? 0,
  _count: card._count ?? {
    comments: 0,
    attachments: card.attachments?.length ?? 0,
  },
});
