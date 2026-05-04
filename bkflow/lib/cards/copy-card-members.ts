import type { BoardMember, Prisma } from "@prisma/client";

type SourceAssignee = {
  boardMember: BoardMember;
};

export const mapTargetMembersByUserId = (targetMembers: BoardMember[]) =>
  new Map(targetMembers.map((member) => [member.userId, member]));

export const copyCardAssignees = async ({
  tx,
  cardId,
  assignees,
  targetMembersByUserId,
}: {
  tx: Prisma.TransactionClient;
  cardId: string;
  assignees: SourceAssignee[];
  targetMembersByUserId: Map<string, BoardMember>;
}) => {
  const copiedMemberIds = new Set<string>();

  for (const assignee of assignees) {
    const targetMember = targetMembersByUserId.get(assignee.boardMember.userId);

    if (!targetMember || copiedMemberIds.has(targetMember.id)) {
      continue;
    }

    copiedMemberIds.add(targetMember.id);
    await tx.cardAssignee.create({
      data: {
        cardId,
        boardMemberId: targetMember.id,
      },
    });
  }
};

export const resolveChecklistItemAssigneeId = ({
  userId,
  targetMembersByUserId,
}: {
  userId: string;
  targetMembersByUserId: Map<string, BoardMember>;
}) => targetMembersByUserId.get(userId)?.id ?? null;
