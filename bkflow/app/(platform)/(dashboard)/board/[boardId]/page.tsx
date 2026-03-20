import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { measureDev } from "@/lib/perf";
import { requireBoardMemberForUser } from "@/lib/permissions";
import type { CardWithAssignees, ListWithCards } from "@/types";

import { BoardCardModalFromUrl } from "./_components/board-card-modal-from-url";
import { ListContainer } from "./_components/list-container";

interface BoardIdPageProps {
  params: Promise<{
    boardId: string;
  }>;
};

const BoardIdPage = async ({
  params,
}: BoardIdPageProps) => {
  const { boardId } = await params;
  const { orgId, userId } = await auth();

  if (!userId) {
    redirect("/select-org");
  }

  const currentMembership = await requireBoardMemberForUser({ boardId, userId });

  if (currentMembership.error || !currentMembership.membership) {
    const errorMessage = currentMembership.error || "Bạn không có quyền truy cập bảng này.";
    redirect(`/organization/${orgId ?? ""}?error=${encodeURIComponent(errorMessage)}`);
  }

  const boardOrgId = currentMembership.membership.board.orgId;
  
  const [listsData, boardMembers] = await measureDev(`board:${boardId}:initial-data`, () => Promise.all([
    db.list.findMany({
      where: {
        boardId,
        archivedAt: null,
        board: {
          orgId: boardOrgId,
        },
      },
      select: {
        id: true,
        title: true,
        order: true,
        archivedAt: true,
        boardId: true,
        createdAt: true,
        updatedAt: true,
        cards: {
          where: {
            archivedAt: null,
          },
          select: {
            id: true,
            title: true,
            order: true,
            description: true,
            startDate: true,
            dueDate: true,
            isCompleted: true,
            reminder: true,
            reminderSetAt: true,
            archivedAt: true,
            archivedByListId: true,
            listId: true,
            createdAt: true,
            updatedAt: true,
            assignees: {
              include: {
                boardMember: true,
              },
              orderBy: {
                createdAt: "asc",
              },
            },
            labels: {
              include: {
                label: true,
              },
              orderBy: {
                createdAt: "asc",
              },
            },
            _count: {
              select: {
                comments: true,
                attachments: true,
              },
            },
          },
          orderBy: {
            order: "asc",
          },
        },
      },
      orderBy: {
        order: "asc",
      },
    }),
    db.boardMember.findMany({
      where: {
        boardId,
        board: {
          orgId: boardOrgId,
          members: {
            some: {
              userId,
            },
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    }),
  ]));

  const cardIds = listsData.flatMap((list) => list.cards.map((card) => card.id));
  const checklistSummaries = cardIds.length > 0
    ? await measureDev(`board:${boardId}:checklist-progress`, () => db.checklist.findMany({
        where: {
          cardId: {
            in: cardIds,
          },
        },
        select: {
          cardId: true,
          items: {
            select: {
              isCompleted: true,
            },
          },
        },
      }))
    : [];
  const checklistProgressByCardId = new Map<string, { total: number; completed: number }>();

  checklistSummaries.forEach((checklist) => {
    const current = checklistProgressByCardId.get(checklist.cardId) ?? {
      total: 0,
      completed: 0,
    };

    current.total += checklist.items.length;
    current.completed += checklist.items.filter((item) => item.isCompleted).length;
    checklistProgressByCardId.set(checklist.cardId, current);
  });

  const lists = listsData.map((list) => ({
    ...list,
    cards: list.cards.map((card) => ({
      ...card,
      checklistProgress: checklistProgressByCardId.get(card.id) ?? {
        total: 0,
        completed: 0,
      },
    })) as CardWithAssignees[],
  })) as ListWithCards[];

  return (
    <div className="p-4 h-full overflow-x-auto">
      <BoardCardModalFromUrl />
      <ListContainer
        boardId={boardId}
        data={lists}
        boardMembers={boardMembers}
        currentUserId={userId}
        currentMemberRole={currentMembership.membership.role}
      />
    </div>
  );
};

export default BoardIdPage;
