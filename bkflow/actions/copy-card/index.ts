"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { ACTION, AUDIT_EVENT_TYPE, ENTITY_TYPE } from "@prisma/client";

import { db } from "@/lib/db";
import { createSafeAction } from "@/lib/create-safe-action";
import { requireBoardEditorForUser, requireBoardMemberForUser } from "@/lib/permissions";
import { triggerCardCreated } from "@/lib/boards/realtime";

import { CopyCard } from "./schema";
import { InputType, ReturnType } from "./types";

const normalizeLabelTitle = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId } = await auth();
  const user = await currentUser();

  if (!userId || !user) {
    return {
      error: "Không có quyền truy cập.",
    };
  }

  const {
    id,
    sourceBoardId,
    targetBoardId,
    targetListId,
    title,
    position,
    keepChecklists,
    keepLabels,
    keepMembers,
    keepAttachments,
    keepComments,
  } = data;
  let card;

  try {
    const [sourcePermission, targetPermission] = await Promise.all([
      requireBoardMemberForUser({ boardId: sourceBoardId, userId }),
      requireBoardEditorForUser({ boardId: targetBoardId, userId }),
    ]);

    if (sourcePermission.error) {
      return { error: sourcePermission.error };
    }

    if (targetPermission.error || !targetPermission.membership) {
      return { error: targetPermission.error || "Không có quyền truy cập bảng đích." };
    }

    const cardToCopy = await db.card.findFirst({
      where: {
        id,
        archivedAt: null,
        list: {
          archivedAt: null,
          board: {
            id: sourceBoardId,
          },
        },
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
    });

    if (!cardToCopy) {
      return { error: "Không tìm thấy thẻ." };
    }

    const [targetList, destinationCards, targetMembers, targetLabels] = await Promise.all([
      db.list.findFirst({
        where: {
          id: targetListId,
          archivedAt: null,
          board: {
            id: targetBoardId,
          },
        },
        select: {
          id: true,
          title: true,
          boardId: true,
        },
      }),
      db.card.findMany({
        where: {
          listId: targetListId,
          archivedAt: null,
        },
        select: {
          id: true,
          order: true,
        },
        orderBy: {
          order: "asc",
        },
      }),
      db.boardMember.findMany({
        where: {
          boardId: targetBoardId,
        },
      }),
      db.label.findMany({
        where: {
          boardId: targetBoardId,
        },
      }),
    ]);

    if (!targetList) {
      return { error: "Không tìm thấy danh sách đích." };
    }

    const insertIndex = Math.min(Math.max(position - 1, 0), destinationCards.length);
    const shouldShiftDestinationCards = insertIndex < destinationCards.length;
    const newOrder = destinationCards.length === 0
      ? 0
      : shouldShiftDestinationCards
        ? destinationCards[insertIndex].order
        : destinationCards[destinationCards.length - 1].order + 1;
    const targetMembersByUserId = new Map(targetMembers.map((member) => [member.userId, member]));
    const targetLabelsById = new Map(targetLabels.map((label) => [label.id, label]));
    const targetLabelsByTitle = new Map(
      targetLabels
        .filter((label) => label.title.trim().length > 0)
        .map((label) => [normalizeLabelTitle(label.title), label]),
    );
    const targetEmptyLabelsByColor = new Map(
      targetLabels
        .filter((label) => label.title.trim().length === 0)
        .map((label) => [label.color, label]),
    );

    card = await db.$transaction(async (tx) => {
      if (shouldShiftDestinationCards) {
        await tx.card.updateMany({
          where: {
            listId: targetListId,
            archivedAt: null,
            order: {
              gte: newOrder,
            },
          },
          data: {
            order: {
              increment: 1,
            },
          },
        });
      }

      const createdCard = await tx.card.create({
        data: {
          title,
          description: cardToCopy.description,
          startDate: cardToCopy.startDate,
          dueDate: cardToCopy.dueDate,
          isCompleted: cardToCopy.isCompleted,
          reminder: cardToCopy.reminder,
          reminderSetAt: cardToCopy.reminderSetAt,
          order: newOrder,
          listId: targetListId,
        },
      });

      if (keepLabels && cardToCopy.labels.length > 0) {
        const copiedLabelIds = new Set<string>();

        for (const cardLabel of cardToCopy.labels) {
          const sourceLabel = cardLabel.label;
          let targetLabel = sourceBoardId === targetBoardId
            ? targetLabelsById.get(sourceLabel.id)
            : null;

          if (!targetLabel) {
            if (sourceLabel.title.trim().length > 0) {
              targetLabel = targetLabelsByTitle.get(normalizeLabelTitle(sourceLabel.title)) ?? null;
            } else {
              targetLabel = targetEmptyLabelsByColor.get(sourceLabel.color) ?? null;
            }
          }

          if (!targetLabel) {
            targetLabel = await tx.label.create({
              data: {
                boardId: targetBoardId,
                title: sourceLabel.title,
                color: sourceLabel.color,
              },
            });

            if (targetLabel.title.trim().length > 0) {
              targetLabelsByTitle.set(normalizeLabelTitle(targetLabel.title), targetLabel);
            } else {
              targetEmptyLabelsByColor.set(targetLabel.color, targetLabel);
            }
          }

          if (copiedLabelIds.has(targetLabel.id)) {
            continue;
          }

          copiedLabelIds.add(targetLabel.id);
          await tx.cardLabel.create({
            data: {
              cardId: createdCard.id,
              labelId: targetLabel.id,
            },
          });
        }
      }

      if (keepMembers && cardToCopy.assignees.length > 0) {
        const copiedMemberIds = new Set<string>();

        for (const assignee of cardToCopy.assignees) {
          const targetMember = targetMembersByUserId.get(assignee.boardMember.userId);

          if (!targetMember || copiedMemberIds.has(targetMember.id)) {
            continue;
          }

          copiedMemberIds.add(targetMember.id);
          await tx.cardAssignee.create({
            data: {
              cardId: createdCard.id,
              boardMemberId: targetMember.id,
            },
          });
        }
      }

      if (keepAttachments && cardToCopy.attachments.length > 0) {
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

      if (keepChecklists && cardToCopy.checklists.length > 0) {
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
              data: checklist.items.map((item) => {
                const targetAssignee = item.assignee
                  ? targetMembersByUserId.get(item.assignee.userId)
                  : null;

                return {
                  checklistId: createdChecklist.id,
                  title: item.title,
                  isCompleted: item.isCompleted,
                  order: item.order,
                  dueDate: item.dueDate,
                  assigneeId: targetAssignee?.id ?? null,
                };
              }),
            });
          }
        }
      }

      if (keepComments && cardToCopy.comments.length > 0) {
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

      await tx.auditLog.create({
        data: {
          orgId: targetPermission.membership.board.orgId,
          boardId: targetBoardId,
          cardId: createdCard.id,
          entityId: createdCard.id,
          entityType: ENTITY_TYPE.CARD,
          entityTitle: `detail:đã sao chép thẻ "${cardToCopy.title}" thành "${createdCard.title}" vào danh sách "${targetList.title}"`,
          action: ACTION.CREATE,
          eventType: AUDIT_EVENT_TYPE.CREATE,
          userId,
          userImage: user.imageUrl,
          userName: user.fullName || user.username || user.primaryEmailAddress?.emailAddress || "Thành viên",
        },
      });

      return createdCard;
    });

    await triggerCardCreated({
      boardId: targetBoardId,
      listId: card.listId,
      cardId: card.id,
      actorUserId: userId,
    });
  } catch (error) {
    console.error("[COPY_CARD_ERROR]", error);
    return {
      error: "Sao chép thẻ thất bại.",
    };
  }

  return { data: card };
};

export const copyCard = createSafeAction(CopyCard, handler);
