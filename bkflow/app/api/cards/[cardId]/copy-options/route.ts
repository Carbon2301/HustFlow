import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { requireBoardMemberForUser } from "@/lib/permissions";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ cardId: string }> },
) {
  try {
    const { cardId } = await params;
    const { userId } = await auth();

    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const card = await db.card.findFirst({
      where: {
        id: cardId,
        archivedAt: null,
        list: {
          archivedAt: null,
        },
      },
      select: {
        id: true,
        listId: true,
        _count: {
          select: {
            assignees: true,
            labels: true,
            attachments: true,
            checklists: true,
            comments: true,
          },
        },
        list: {
          select: {
            boardId: true,
          },
        },
      },
    });

    if (!card) {
      return new NextResponse("Not Found", { status: 404 });
    }

    const permission = await requireBoardMemberForUser({
      boardId: card.list.boardId,
      userId,
    });

    if (permission.error) {
      return new NextResponse(permission.error, { status: 403 });
    }

    const client = await clerkClient();
    const memberships = await client.users.getOrganizationMembershipList({
      userId,
      limit: 100,
    });
    const organizations = memberships.data.map((membership) => ({
      id: membership.organization.id,
      name: membership.organization.name,
      imageUrl: membership.organization.imageUrl,
    }));
    const organizationIds = organizations.map((organization) => organization.id);

    const boards = organizationIds.length > 0
      ? await db.board.findMany({
          where: {
            orgId: {
              in: organizationIds,
            },
            members: {
              some: {
                userId,
              },
            },
          },
          select: {
            id: true,
            title: true,
            orgId: true,
            lists: {
              where: {
                archivedAt: null,
              },
              select: {
                id: true,
                title: true,
                order: true,
                _count: {
                  select: {
                    cards: {
                      where: {
                        archivedAt: null,
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
            createdAt: "desc",
          },
        })
      : [];

    return NextResponse.json({
      currentBoardId: card.list.boardId,
      currentListId: card.listId,
      sourceCounts: {
        checklists: card._count.checklists,
        labels: card._count.labels,
        members: card._count.assignees,
        attachments: card._count.attachments,
        comments: card._count.comments,
      },
      organizations,
      boards: boards.map((board) => ({
        id: board.id,
        title: board.title,
        orgId: board.orgId,
        isCurrent: board.id === card.list.boardId,
        lists: board.lists.map((list) => ({
          id: list.id,
          title: list.title,
          order: list.order,
          cardCount: list._count.cards,
          isCurrent: list.id === card.listId,
        })),
      })),
    });
  } catch (error) {
    console.error("[CARD_COPY_OPTIONS_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
