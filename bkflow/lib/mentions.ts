import { BoardMember } from "@prisma/client";

const getMentionKey = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w]/g, "")
    .toLowerCase();

export const findMentionedBoardMembers = (
  content: string,
  boardMembers: BoardMember[],
) => {
  const mentionKeys = new Set(
    Array.from(content.matchAll(/@([\p{L}\p{N}_-]+)/gu)).map((match) =>
      getMentionKey(match[1]),
    ),
  );

  if (mentionKeys.size === 0) {
    return [];
  }

  return boardMembers.filter((member) => {
    const names = [
      member.userName,
      member.userEmail?.split("@")[0],
    ].filter((value): value is string => Boolean(value));

    return names.some((name) => mentionKeys.has(getMentionKey(name)));
  });
};
