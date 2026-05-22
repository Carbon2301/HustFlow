import ExcelJS from "exceljs";

import { db } from "@/lib/db";

type BoardExportData = NonNullable<Awaited<ReturnType<typeof getBoardExportData>>>;
type BoardExportList = BoardExportData["lists"][number];
type BoardExportCard = BoardExportList["cards"][number];

const DATE_FORMAT = "yyyy-mm-dd";
const DATE_TIME_FORMAT = "yyyy-mm-dd hh:mm";

const formatCsvDate = (date: Date | null) =>
  date ? date.toISOString().slice(0, 10) : "";

const formatCsvDateTime = (date: Date | null) =>
  date ? date.toISOString() : "";

const escapeCsvValue = (value: string | number | boolean | null | undefined) => {
  let text = value === null || value === undefined ? "" : String(value);

  if (/^[=+\-@]/.test(text)) {
    text = `'${text}`;
  }

  if (!/[",\r\n]/.test(text)) {
    return text;
  }

  return `"${text.replace(/"/g, '""')}"`;
};

const joinNames = (values: string[]) => values.filter(Boolean).join(", ");

const getChecklistProgress = (card: BoardExportCard) => {
  const totals = card.checklists.reduce(
    (progress, checklist) => {
      progress.total += checklist.items.length;
      progress.completed += checklist.items.filter((item) => item.isCompleted).length;
      return progress;
    },
    { total: 0, completed: 0 },
  );

  return totals;
};

const getCardStatus = (card: BoardExportCard, now = new Date()) => {
  if (card.isCompleted) {
    return "Completed";
  }

  if (card.dueDate && card.dueDate.getTime() < now.getTime()) {
    return "Overdue";
  }

  return "Open";
};

const getCardAssigneeNames = (card: BoardExportCard) =>
  joinNames(card.assignees.map((assignee) => assignee.boardMember.userName));

const getCardLabelNames = (card: BoardExportCard) =>
  joinNames(card.labels.map(({ label }) => label.title));

export const getBoardExportData = async ({
  boardId,
  orgId,
}: {
  boardId: string;
  orgId: string;
}) => {
  const [board, dependencies] = await Promise.all([
    db.board.findFirst({
      where: {
        id: boardId,
        orgId,
      },
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
        members: {
          select: {
            id: true,
            userName: true,
            userEmail: true,
            role: true,
            createdAt: true,
          },
          orderBy: {
            createdAt: "asc",
          },
        },
        lists: {
          where: {
            archivedAt: null,
          },
          select: {
            id: true,
            title: true,
            order: true,
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
                createdAt: true,
                updatedAt: true,
                assignees: {
                  select: {
                    boardMember: {
                      select: {
                        id: true,
                        userId: true,
                        userName: true,
                        userEmail: true,
                      },
                    },
                  },
                  orderBy: {
                    createdAt: "asc",
                  },
                },
                labels: {
                  select: {
                    label: {
                      select: {
                        id: true,
                        title: true,
                        color: true,
                      },
                    },
                  },
                  orderBy: {
                    createdAt: "asc",
                  },
                },
                checklists: {
                  select: {
                    id: true,
                    title: true,
                    order: true,
                    items: {
                      select: {
                        id: true,
                        title: true,
                        isCompleted: true,
                        dueDate: true,
                        order: true,
                        assignee: {
                          select: {
                            id: true,
                            userName: true,
                            userEmail: true,
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
                },
                blockedByDependencies: {
                  where: {
                    blockerCard: {
                      isCompleted: false,
                      archivedAt: null,
                    },
                  },
                  select: {
                    id: true,
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
        },
      },
    }),
    db.cardDependency.findMany({
      where: {
        blockerCard: {
          archivedAt: null,
          list: {
            archivedAt: null,
            board: {
              id: boardId,
              orgId,
            },
          },
        },
        blockedCard: {
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
        blockerCard: {
          select: {
            id: true,
            title: true,
            isCompleted: true,
            list: {
              select: {
                title: true,
              },
            },
          },
        },
        blockedCard: {
          select: {
            id: true,
            title: true,
            isCompleted: true,
            list: {
              select: {
                title: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    }),
  ]);

  if (!board) {
    return null;
  }

  return {
    ...board,
    dependencies,
  };
};

export const getBoardExportSummary = (data: BoardExportData, now = new Date()) => {
  const cards = data.lists.flatMap((list) => list.cards);
  const completed = cards.filter((card) => card.isCompleted).length;
  const overdue = cards.filter((card) => (
    !card.isCompleted &&
    card.dueDate !== null &&
    card.dueDate.getTime() < now.getTime()
  )).length;
  const unscheduled = cards.filter((card) => !card.startDate && !card.dueDate).length;

  return {
    totalLists: data.lists.length,
    totalCards: cards.length,
    completed,
    open: cards.length - completed,
    overdue,
    unscheduled,
  };
};

const getCardExportRows = (data: BoardExportData, now = new Date()) =>
  data.lists.flatMap((list) => list.cards.map((card) => {
    const checklistProgress = getChecklistProgress(card);

    return {
      board: data.title,
      list: list.title,
      title: card.title,
      description: card.description ?? "",
      status: getCardStatus(card, now),
      startDate: card.startDate,
      dueDate: card.dueDate,
      assignees: getCardAssigneeNames(card),
      labels: getCardLabelNames(card),
      checklistProgress: `${checklistProgress.completed}/${checklistProgress.total}`,
      commentsCount: card._count.comments,
      attachmentsCount: card._count.attachments,
      blockedByCount: card.blockedByDependencies.length,
      createdAt: card.createdAt,
      updatedAt: card.updatedAt,
    };
  }));

export const buildBoardCsv = (data: BoardExportData) => {
  const rows = getCardExportRows(data);
  const headers = [
    "Board",
    "List",
    "Card title",
    "Description",
    "Status",
    "Start date",
    "Due date",
    "Assignees",
    "Labels",
    "Checklist progress",
    "Comments count",
    "Attachments count",
    "Blocked by count",
    "Created at",
    "Updated at",
  ];
  const csvRows = rows.map((row) => [
    row.board,
    row.list,
    row.title,
    row.description,
    row.status,
    formatCsvDate(row.startDate),
    formatCsvDate(row.dueDate),
    row.assignees,
    row.labels,
    row.checklistProgress,
    row.commentsCount,
    row.attachmentsCount,
    row.blockedByCount,
    formatCsvDateTime(row.createdAt),
    formatCsvDateTime(row.updatedAt),
  ]);

  return [
    headers.map(escapeCsvValue).join(","),
    ...csvRows.map((row) => row.map(escapeCsvValue).join(",")),
  ].join("\r\n");
};

const styleWorksheet = (worksheet: ExcelJS.Worksheet) => {
  worksheet.views = [{ state: "frozen", ySplit: 1 }];
  const header = worksheet.getRow(1);

  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF6D28D9" },
  };
  header.alignment = { vertical: "middle" };

  worksheet.columns.forEach((column) => {
    let width = 12;

    column.eachCell?.({ includeEmpty: true }, (cell) => {
      const value = cell.value;
      const text = value instanceof Date
        ? "yyyy-mm-dd hh:mm"
        : String(value ?? "");

      width = Math.max(width, Math.min(text.length + 2, 48));
    });

    column.width = width;
  });
};

export const buildBoardWorkbookBuffer = async (data: BoardExportData) => {
  const workbook = new ExcelJS.Workbook();
  const exportedAt = new Date();
  const summary = getBoardExportSummary(data, exportedAt);

  workbook.creator = "HustFlow";
  workbook.created = exportedAt;
  workbook.modified = exportedAt;

  const summarySheet = workbook.addWorksheet("Summary");
  summarySheet.columns = [
    { header: "Metric", key: "metric" },
    { header: "Value", key: "value" },
  ];
  summarySheet.addRows([
    { metric: "Board", value: data.title },
    { metric: "Exported at", value: exportedAt },
    { metric: "Total lists", value: summary.totalLists },
    { metric: "Total cards", value: summary.totalCards },
    { metric: "Completed cards", value: summary.completed },
    { metric: "Open cards", value: summary.open },
    { metric: "Overdue cards", value: summary.overdue },
    { metric: "Unscheduled cards", value: summary.unscheduled },
  ]);
  summarySheet.getCell("B3").numFmt = DATE_TIME_FORMAT;
  styleWorksheet(summarySheet);

  const cardsSheet = workbook.addWorksheet("Cards");
  cardsSheet.columns = [
    { header: "Board", key: "board" },
    { header: "List", key: "list" },
    { header: "Card title", key: "title" },
    { header: "Description", key: "description" },
    { header: "Status", key: "status" },
    { header: "Start date", key: "startDate", style: { numFmt: DATE_FORMAT } },
    { header: "Due date", key: "dueDate", style: { numFmt: DATE_FORMAT } },
    { header: "Assignees", key: "assignees" },
    { header: "Labels", key: "labels" },
    { header: "Checklist progress", key: "checklistProgress" },
    { header: "Comments count", key: "commentsCount" },
    { header: "Attachments count", key: "attachmentsCount" },
    { header: "Blocked by count", key: "blockedByCount" },
    { header: "Created at", key: "createdAt", style: { numFmt: DATE_TIME_FORMAT } },
    { header: "Updated at", key: "updatedAt", style: { numFmt: DATE_TIME_FORMAT } },
  ];
  cardsSheet.addRows(getCardExportRows(data));
  styleWorksheet(cardsSheet);

  const listsSheet = workbook.addWorksheet("Lists");
  listsSheet.columns = [
    { header: "List", key: "list" },
    { header: "Total cards", key: "total" },
    { header: "Completed cards", key: "completed" },
    { header: "Open cards", key: "open" },
    { header: "Overdue cards", key: "overdue" },
  ];
  listsSheet.addRows(data.lists.map((list) => {
    const completed = list.cards.filter((card) => card.isCompleted).length;
    const overdue = list.cards.filter((card) => getCardStatus(card, exportedAt) === "Overdue").length;

    return {
      list: list.title,
      total: list.cards.length,
      completed,
      open: list.cards.length - completed,
      overdue,
    };
  }));
  styleWorksheet(listsSheet);

  const memberRows = new Map<string, {
    member: string;
    email: string;
    total: number;
    completed: number;
    overdue: number;
  }>();

  data.members.forEach((member) => {
    memberRows.set(member.id, {
      member: member.userName,
      email: member.userEmail ?? "",
      total: 0,
      completed: 0,
      overdue: 0,
    });
  });

  data.lists.forEach((list) => {
    list.cards.forEach((card) => {
      card.assignees.forEach((assignee) => {
        const member = assignee.boardMember;
        const current = memberRows.get(member.id) ?? {
          member: member.userName,
          email: member.userEmail ?? "",
          total: 0,
          completed: 0,
          overdue: 0,
        };

        current.total += 1;
        current.completed += card.isCompleted ? 1 : 0;
        current.overdue += getCardStatus(card, exportedAt) === "Overdue" ? 1 : 0;
        memberRows.set(member.id, current);
      });
    });
  });

  const membersSheet = workbook.addWorksheet("Members");
  membersSheet.columns = [
    { header: "Member", key: "member" },
    { header: "Email", key: "email" },
    { header: "Assigned cards", key: "total" },
    { header: "Completed cards", key: "completed" },
    { header: "Overdue cards", key: "overdue" },
  ];
  membersSheet.addRows(Array.from(memberRows.values()));
  styleWorksheet(membersSheet);

  const dependenciesSheet = workbook.addWorksheet("Dependencies");
  dependenciesSheet.columns = [
    { header: "Blocker card", key: "blocker" },
    { header: "Blocker list", key: "blockerList" },
    { header: "Blocker completed", key: "blockerCompleted" },
    { header: "Blocked card", key: "blocked" },
    { header: "Blocked list", key: "blockedList" },
    { header: "Blocked completed", key: "blockedCompleted" },
  ];
  dependenciesSheet.addRows(data.dependencies.map((dependency) => ({
    blocker: dependency.blockerCard.title,
    blockerList: dependency.blockerCard.list.title,
    blockerCompleted: dependency.blockerCard.isCompleted ? "Yes" : "No",
    blocked: dependency.blockedCard.title,
    blockedList: dependency.blockedCard.list.title,
    blockedCompleted: dependency.blockedCard.isCompleted ? "Yes" : "No",
  })));
  styleWorksheet(dependenciesSheet);

  const checklistsSheet = workbook.addWorksheet("Checklists");
  checklistsSheet.columns = [
    { header: "Card", key: "card" },
    { header: "List", key: "list" },
    { header: "Checklist", key: "checklist" },
    { header: "Item", key: "item" },
    { header: "Completed", key: "completed" },
    { header: "Due date", key: "dueDate", style: { numFmt: DATE_FORMAT } },
    { header: "Assignee", key: "assignee" },
  ];
  checklistsSheet.addRows(data.lists.flatMap((list) =>
    list.cards.flatMap((card) =>
      card.checklists.flatMap((checklist) =>
        checklist.items.map((item) => ({
          card: card.title,
          list: list.title,
          checklist: checklist.title,
          item: item.title,
          completed: item.isCompleted ? "Yes" : "No",
          dueDate: item.dueDate,
          assignee: item.assignee?.userName ?? "",
        })),
      ),
    ),
  ));
  styleWorksheet(checklistsSheet);

  return workbook.xlsx.writeBuffer();
};
