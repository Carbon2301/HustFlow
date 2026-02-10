import { AttachmentType } from "@prisma/client";
import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/lib/db";
import { requireBoardMember } from "@/lib/permissions";
import type { BoardSearchResponse, BoardSearchResult } from "@/types";

const MIN_QUERY_LENGTH = 2;
const MAX_QUERY_LENGTH = 100;
const PER_TYPE_LIMIT = 6;
const TOTAL_LIMIT = 25;

const normalizeSnippet = (value: string | null | undefined) => {
  if (!value) {
    return "";
  }

  return value.replace(/\s+/g, " ").trim();
};

const makeSnippet = (value: string | null | undefined, query: string) => {
  const normalized = normalizeSnippet(value);

  if (!normalized) {
    return "";
  }

  const lowerValue = normalized.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const matchIndex = lowerValue.indexOf(lowerQuery);
  const start = Math.max(matchIndex === -1 ? 0 : matchIndex - 48, 0);
  const end = Math.min(start + 140, normalized.length);
  const prefix = start > 0 ? "..." : "";
  const suffix = end < normalized.length ? "..." : "";

  return `${prefix}${normalized.slice(start, end)}${suffix}`;
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ boardId: string }> },
) {
  try {
    const { boardId } = await params;
    const { userId, orgId } = await auth();

    if (!userId || !orgId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const permission = await requireBoardMember({ boardId, orgId, userId });

    if (permission.error) {
      return new NextResponse(permission.error, { status: 403 });
    }

    const query = (request.nextUrl.searchParams.get("q") ?? "")
      .trim()
      .slice(0, MAX_QUERY_LENGTH);

    if (query.length < MIN_QUERY_LENGTH) {
      return NextResponse.json({ items: [] } satisfies BoardSearchResponse);
    }

    const [titleCards, descriptionCards, checklists, checklistItems, comments, attachments] =
      await Promise.all([
        db.card.findMany({
          where: {
            archivedAt: null,
            title: {
              contains: query,
            },
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
            description: true,
            listId: true,
            list: {
              select: {
                title: true,
                order: true,
              },
            },
            order: true,
          },
          orderBy: [
            {
              list: {
                order: "asc",
              },
            },
            {
              order: "asc",
            },
          ],
          take: PER_TYPE_LIMIT,
        }),
        db.card.findMany({
          where: {
            archivedAt: null,
            description: {
              contains: query,
            },
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
            description: true,
            listId: true,
            list: {
              select: {
                title: true,
                order: true,
              },
            },
            order: true,
          },
          orderBy: [
            {
              list: {
                order: "asc",
              },
            },
            {
              order: "asc",
            },
          ],
          take: PER_TYPE_LIMIT,
        }),
        db.checklist.findMany({
          where: {
            title: {
              contains: query,
            },
            card: {
              archivedAt: null,
              list: {
                archivedAt: null,
                board: {
                  id: boardId,
                  orgId,
                },
              },
            },
          },
          select: {
            id: true,
            title: true,
            order: true,
            card: {
              select: {
                id: true,
                title: true,
                order: true,
                listId: true,
                list: {
                  select: {
                    title: true,
                    order: true,
                  },
                },
              },
            },
          },
          orderBy: [
            {
              card: {
                list: {
                  order: "asc",
                },
              },
            },
            {
              card: {
                order: "asc",
              },
            },
            {
              order: "asc",
            },
          ],
          take: PER_TYPE_LIMIT,
        }),
        db.checklistItem.findMany({
          where: {
            title: {
              contains: query,
            },
            checklist: {
              card: {
                archivedAt: null,
                list: {
                  archivedAt: null,
                  board: {
                    id: boardId,
                    orgId,
                  },
                },
              },
            },
          },
          select: {
            id: true,
            title: true,
            order: true,
            checklist: {
              select: {
                title: true,
                order: true,
                card: {
                  select: {
                    id: true,
                    title: true,
                    order: true,
                    listId: true,
                    list: {
                      select: {
                        title: true,
                        order: true,
                      },
                    },
                  },
                },
              },
            },
          },
          orderBy: [
            {
              checklist: {
                card: {
                  list: {
                    order: "asc",
                  },
                },
              },
            },
            {
              checklist: {
                card: {
                  order: "asc",
                },
              },
            },
            {
              checklist: {
                order: "asc",
              },
            },
            {
              order: "asc",
            },
          ],
          take: PER_TYPE_LIMIT,
        }),
        db.cardComment.findMany({
          where: {
            content: {
              contains: query,
            },
            card: {
              archivedAt: null,
              list: {
                archivedAt: null,
                board: {
                  id: boardId,
                  orgId,
                },
              },
            },
          },
          select: {
            id: true,
            content: true,
            userName: true,
            createdAt: true,
            card: {
              select: {
                id: true,
                title: true,
                order: true,
                listId: true,
                list: {
                  select: {
                    title: true,
                    order: true,
                  },
                },
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
          take: PER_TYPE_LIMIT,
        }),
        db.cardAttachment.findMany({
          where: {
            OR: [
              {
                name: {
                  contains: query,
                },
              },
              {
                type: AttachmentType.LINK,
                url: {
                  contains: query,
                },
              },
            ],
            card: {
              archivedAt: null,
              list: {
                archivedAt: null,
                board: {
                  id: boardId,
                  orgId,
                },
              },
            },
          },
          select: {
            id: true,
            type: true,
            name: true,
            url: true,
            order: true,
            card: {
              select: {
                id: true,
                title: true,
                order: true,
                listId: true,
                list: {
                  select: {
                    title: true,
                    order: true,
                  },
                },
              },
            },
          },
          orderBy: [
            {
              card: {
                list: {
                  order: "asc",
                },
              },
            },
            {
              card: {
                order: "asc",
              },
            },
            {
              type: "asc",
            },
            {
              order: "asc",
            },
          ],
          take: PER_TYPE_LIMIT,
        }),
      ]);

    const cardTitleResults: BoardSearchResult[] = titleCards.map((card) => ({
      type: "card",
      id: `card:${card.id}`,
      cardId: card.id,
      cardTitle: card.title,
      listId: card.listId,
      listTitle: card.list.title,
      title: card.title,
      snippet: null,
    }));

    const descriptionResults: BoardSearchResult[] = descriptionCards.map((card) => ({
      type: "description",
      id: `description:${card.id}`,
      cardId: card.id,
      cardTitle: card.title,
      listId: card.listId,
      listTitle: card.list.title,
      title: "Mô tả thẻ",
      snippet: makeSnippet(card.description, query),
    }));

    const checklistTitleResults: BoardSearchResult[] = checklists.map((checklist) => ({
      type: "checklist",
      id: `checklist:${checklist.id}`,
      checklistId: checklist.id,
      cardId: checklist.card.id,
      cardTitle: checklist.card.title,
      listId: checklist.card.listId,
      listTitle: checklist.card.list.title,
      title: checklist.title,
      snippet: null,
    }));

    const checklistResults: BoardSearchResult[] = checklistItems.map((item) => ({
      type: "checklist-item",
      id: `checklist-item:${item.id}`,
      checklistItemId: item.id,
      checklistTitle: item.checklist.title,
      cardId: item.checklist.card.id,
      cardTitle: item.checklist.card.title,
      listId: item.checklist.card.listId,
      listTitle: item.checklist.card.list.title,
      title: item.title,
      snippet: null,
    }));

    const commentResults: BoardSearchResult[] = comments.map((comment) => ({
      type: "comment",
      id: `comment:${comment.id}`,
      commentId: comment.id,
      cardId: comment.card.id,
      cardTitle: comment.card.title,
      listId: comment.card.listId,
      listTitle: comment.card.list.title,
      title: makeSnippet(comment.content, query),
      snippet: null,
      userName: comment.userName,
    }));

    const attachmentResults: BoardSearchResult[] = attachments.map((attachment) => {
      const urlMatches =
        attachment.type === AttachmentType.LINK &&
        attachment.url.toLowerCase().includes(query.toLowerCase());

      return {
        type: "attachment",
        id: `attachment:${attachment.id}`,
        attachmentId: attachment.id,
        cardId: attachment.card.id,
        cardTitle: attachment.card.title,
        listId: attachment.card.listId,
        listTitle: attachment.card.list.title,
        title: attachment.name,
        snippet: urlMatches ? makeSnippet(attachment.url, query) : null,
        attachmentType: attachment.type,
      };
    });

    const response: BoardSearchResponse = {
      items: [
        ...cardTitleResults,
        ...descriptionResults,
        ...checklistTitleResults,
        ...checklistResults,
        ...commentResults,
        ...attachmentResults,
      ].slice(0, TOTAL_LIMIT),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[BOARD_SEARCH_GET_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
