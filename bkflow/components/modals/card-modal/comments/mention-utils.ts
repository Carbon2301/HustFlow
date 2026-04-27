import type { BoardMember } from "@prisma/client";

export type MentionSuggestionOption = {
  id: string;
  name: string;
  tag: string;
  isSpecial: boolean;
  image?: string | null;
};

export const getMentionKey = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w]/g, "")
    .toLowerCase();

export const getMentionTag = (member: Pick<BoardMember, "userName" | "userEmail">) => {
  const rawTag = member.userEmail?.split("@")[0] || member.userName;
  const normalizedTag = rawTag.replace(/\s+/g, "").trim();

  return `@${normalizedTag || "thanhvien"}`;
};

export const getCanonicalMention = (mention: string, boardMembers: BoardMember[]) => {
  const mentionKey = getMentionKey(mention.replace(/^@/, ""));
  const matchedMember = boardMembers.find((member) => {
    const keys = [
      member.userName,
      member.userEmail?.split("@")[0],
    ].filter((value): value is string => Boolean(value));

    return keys.some((key) => getMentionKey(key) === mentionKey);
  });

  return matchedMember ? getMentionTag(matchedMember) : mention;
};

export const getMentionSuggestionOptions = (
  boardMembers: BoardMember[],
  mentionQuery: string,
) => {
  const allOptions: MentionSuggestionOption[] = [
    {
      id: "card",
      name: "Toàn bộ thành viên trong thẻ",
      tag: "@card",
      isSpecial: true,
      image: undefined,
    },
    {
      id: "board",
      name: "Toàn bộ thành viên trong bảng",
      tag: "@board",
      isSpecial: true,
      image: undefined,
    },
    ...boardMembers.map((member) => ({
      id: member.id,
      name: member.userName,
      image: member.userImage,
      tag: getMentionTag(member),
      isSpecial: false,
    })),
  ];

  if (!mentionQuery) {
    return allOptions;
  }

  const q = mentionQuery.toLowerCase();

  return allOptions.filter(
    (opt) =>
      opt.name.toLowerCase().includes(q) ||
      opt.tag.toLowerCase().includes(q),
  );
};

export const getMentionStateAtCursor = (
  value: string,
  selectionStart: number,
) => {
  const textBeforeCursor = value.slice(0, selectionStart);
  const lastAtIdx = textBeforeCursor.lastIndexOf("@");

  if (lastAtIdx === -1) {
    return null;
  }

  const charBeforeAt = lastAtIdx > 0 ? textBeforeCursor[lastAtIdx - 1] : "";

  if (charBeforeAt !== "" && !/\s/.test(charBeforeAt)) {
    return null;
  }

  const textAfterAt = textBeforeCursor.slice(lastAtIdx + 1);

  if (/\s/.test(textAfterAt)) {
    return null;
  }

  return {
    query: textAfterAt,
    triggerIndex: lastAtIdx,
  };
};

export const insertMentionSuggestion = ({
  content,
  cursorPosition,
  mentionTriggerIndex,
  tag,
}: {
  content: string;
  cursorPosition: number;
  mentionTriggerIndex: number;
  tag: string;
}) => {
  const beforeMention = content.slice(0, mentionTriggerIndex);
  const afterMention = content.slice(cursorPosition);
  const nextContent = `${beforeMention}${tag} ${afterMention}`;

  return {
    nextContent,
    nextCursorPosition: mentionTriggerIndex + tag.length + 1,
  };
};
