import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { requireBoardMember } from "@/lib/permissions";

import { ListContainer } from "../_components/list-container";
import { BoardCalendarView } from "../calendar/_components/board-calendar-view";
import { SplitPane } from "./_components/split-pane";

interface BoardSplitPageProps {
  params: Promise<{
    boardId: string;
  }>;
}

const BoardSplitPage = async ({
  params,
}: BoardSplitPageProps) => {
  const { boardId } = await params;
  const { orgId, userId } = await auth();

  if (!orgId || !userId) {
    redirect("/select-org");
  }

  const currentMembership = await requireBoardMember({ boardId, orgId, userId });

  if (currentMembership.error || !currentMembership.membership) {
    const errorMessage = currentMembership.error || "Bạn không có quyền truy cập bảng này.";
    redirect(`/organization/${orgId}?error=${encodeURIComponent(errorMessage)}`);
  }

  const lists = await db.list.findMany({
    where: {
      boardId,
      board: {
        orgId,
      },
    },
    include: {
      cards: {
        include: {
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
          checklists: {
            select: {
              items: {
                select: {
                  isCompleted: true,
                },
              },
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
  });

  const boardMembers = await db.boardMember.findMany({
    where: {
      boardId,
      board: {
        orgId,
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
  });

  const calendarLists = lists.map((list) => ({
    id: list.id,
    title: list.title,
    order: list.order,
  }));

  return (
    <SplitPane
      calendarNode={
        <BoardCalendarView
          boardId={boardId}
          lists={calendarLists}
          currentBoardMemberId={currentMembership.membership.id}
          defaultUnscheduledCollapsed
          variant="split"
        />
      }
      boardNode={
        <ListContainer
          boardId={boardId}
          data={lists}
          boardMembers={boardMembers}
          currentUserId={userId}
          currentMemberRole={currentMembership.membership.role}
          enableCalendarDragHandle
        />
      }
    />
  );
};

export default BoardSplitPage;
