"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { ACTION, ENTITY_TYPE } from "@prisma/client";

import { db } from "@/lib/db";
import { createAuditLog } from "@/lib/create-audit-log";
import { createSafeAction } from "@/lib/create-safe-action";
import { requireBoardMember } from "@/lib/permissions";
import { triggerListCreated } from "@/lib/boards/realtime";

import { CopyList } from "./schema";
import { InputType, ReturnType } from "./types";

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId, orgId } = await auth();

  if (!userId || !orgId) {
    return {
      error: "Không có quyền truy cập.",
    };
  }

  const { id, boardId } = data;
  let list;

  try {
    const permission = await requireBoardMember({ boardId, orgId, userId });

    if (permission.error) {
      return { error: permission.error };
    }

    const listToCopy = await db.list.findFirst({
      where: {
        id,
        boardId,
        archivedAt: null,
        board: {
          orgId,
        },
      },
      include: {
        cards: {
          where: {
            archivedAt: null,
          },
          include: {
            labels: {
              include: {
                label: true,
              },
              orderBy: {
                createdAt: "asc",
              },
            },
            assignees: {
              include: {
                boardMember: true,
              },
              orderBy: {
                createdAt: "asc",
              },
            },
            attachments: {
              orderBy: [
                { type: "asc" },
                { order: "asc" },
                { createdAt: "desc" },
              ],
            },
            checklists: {
              include: {
                items: {
                  include: {
                    assignee: true,
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
            comments: {
              include: {
                reactions: {
                  orderBy: {
                    createdAt: "asc",
                  },
                },
              },
              orderBy: {
                createdAt: "asc",
              },
            },
          },
          orderBy: {
            order: "asc",
          },
        },
      },
    });

    if (!listToCopy) {
      return { error: "Không tìm thấy danh sách." };
    }

    const newOrder = listToCopy.order + 1;

    list = await db.$transaction(async (tx) => {
      await tx.list.updateMany({
        where: {
          boardId,
          archivedAt: null,
          order: {
            gte: newOrder,
          },
          board: {
            orgId,
          },
        },
        data: {
          order: {
            increment: 1,
          },
        },
      });

      const createdList = await tx.list.create({
        data: {
          boardId: listToCopy.boardId,
          title: `${listToCopy.title} - Bản sao`,
          order: newOrder,
        },
        include: {
          cards: true,
        },
      });

      for (const cardToCopy of listToCopy.cards) {
        const createdCard = await tx.card.create({
          data: {
            listId: createdList.id,
            title: cardToCopy.title,
            description: cardToCopy.description,
            startDate: cardToCopy.startDate,
            dueDate: cardToCopy.dueDate,
            isCompleted: cardToCopy.isCompleted,
            reminder: cardToCopy.reminder,
            reminderSetAt: cardToCopy.reminderSetAt,
            order: cardToCopy.order,
          },
        });

        if (cardToCopy.labels.length > 0) {
          await tx.cardLabel.createMany({
            data: cardToCopy.labels.map((cardLabel) => ({
              cardId: createdCard.id,
              labelId: cardLabel.labelId,
            })),
            skipDuplicates: true,
          });
        }

        if (cardToCopy.assignees.length > 0) {
          await tx.cardAssignee.createMany({
            data: cardToCopy.assignees.map((assignee) => ({
              cardId: createdCard.id,
              boardMemberId: assignee.boardMemberId,
            })),
            skipDuplicates: true,
          });
        }

        if (cardToCopy.attachments.length > 0) {
          await tx.cardAttachment.createMany({
            data: cardToCopy.attachments.map((attachment) => ({
              cardId: createdCard.id,
              type: attachment.type,
              order: attachment.order,
              name: attachment.name,
              url: attachment.url,
              fileKey: attachment.fileKey,
              fileSize: attachment.fileSize,
              mimeType: attachment.mimeType,
            })),
          });
        }

        if (cardToCopy.checklists.length > 0) {
          for (const checklist of cardToCopy.checklists) {
            const createdChecklist = await tx.checklist.create({
              data: {
                cardId: createdCard.id,
                title: checklist.title,
                order: checklist.order,
              },
            });

            if (checklist.items.length > 0) {
              await tx.checklistItem.createMany({
                data: checklist.items.map((item) => ({
                  checklistId: createdChecklist.id,
                  title: item.title,
                  isCompleted: item.isCompleted,
                  order: item.order,
                  dueDate: item.dueDate,
                  assigneeId: item.assigneeId,
                })),
              });
            }
          }
        }

        if (cardToCopy.comments.length > 0) {
          const commentIdMap = new Map<string, string>();
          const pendingComments = [...cardToCopy.comments];

          while (pendingComments.length > 0) {
            const pendingCount = pendingComments.length;

            for (let index = pendingComments.length - 1; index >= 0; index -= 1) {
              const commentToCopy = pendingComments[index];
              const parentId = commentToCopy.parentId
                ? commentIdMap.get(commentToCopy.parentId)
                : null;

              if (commentToCopy.parentId && !parentId) {
                continue;
              }

              const createdComment = await tx.cardComment.create({
                data: {
                  cardId: createdCard.id,
                  userId: commentToCopy.userId,
                  userName: commentToCopy.userName,
                  userImage: commentToCopy.userImage,
                  content: commentToCopy.content,
                  parentId,
                  createdAt: commentToCopy.createdAt,
                  updatedAt: commentToCopy.updatedAt,
                },
              });

              commentIdMap.set(commentToCopy.id, createdComment.id);

              if (commentToCopy.reactions.length > 0) {
                await tx.cardCommentReaction.createMany({
                  data: commentToCopy.reactions.map((reaction) => ({
                    commentId: createdComment.id,
                    userId: reaction.userId,
                    emoji: reaction.emoji,
                  })),
                  skipDuplicates: true,
                });
              }

              pendingComments.splice(index, 1);
            }

            if (pendingComments.length === pendingCount) {
              break;
            }
          }
        }
      }

      return tx.list.findUnique({
        where: {
          id: createdList.id,
        },
        include: {
          cards: true,
        },
      });
    });

    if (!list) {
      return { error: "Sao chép danh sách thất bại." };
    }

    await createAuditLog({
      entityTitle: list.title,
      entityId: list.id,
      entityType: ENTITY_TYPE.LIST,
      action: ACTION.CREATE,
      boardId,
    });

    await triggerListCreated({
      boardId,
      listId: list.id,
      actorUserId: userId,
    });
  } catch (error) {
    console.error("[COPY_LIST_ERROR]", error);
    return {
      error: "Sao chép danh sách thất bại.",
    };
  }

  revalidatePath(`/board/${boardId}`);
  return { data: list };
};

export const copyList = createSafeAction(CopyList, handler);
