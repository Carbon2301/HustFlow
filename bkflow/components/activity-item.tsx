import { format } from "date-fns";
import { AuditLog } from "@prisma/client";
import Link from "next/link";
import { Users } from "lucide-react";

import { generateLogMessage } from "@/lib/generate-log-message";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

interface ActivityItemProps {
  data: AuditLog;
  boardTitle?: string;
  cardTitle?: string;
  cardArchived?: boolean;
  listExists?: boolean;
  memberNames?: string[];
  isCardModal?: boolean;
}

const getCardTitleFromMessage = (message: string) => {
  const match = message.match(/(?:thẻ|vào thẻ|khỏi thẻ|trong thẻ)\s+["“]([^"”]+)["”]/);
  return match ? match[1] : null;
};

const getBoardTitleFromMessage = (message: string) => {
  const match = message.match(/(?:bảng|trong bảng|khỏi bảng)\s+["“]([^"”]+)["”]/);
  return match ? match[1] : null;
};

const replaceTextWithLink = (
  nodes: React.ReactNode[],
  targetText: string,
  href: string,
  linkLabel: string,
  prepend?: string
) => {
  const result: React.ReactNode[] = [];
  nodes.forEach((node) => {
    if (typeof node === "string") {
      const parts = node.split(targetText);
      parts.forEach((part, index) => {
        if (part) result.push(part);
        if (index < parts.length - 1) {
          result.push(
            <span key={`${href}-${index}`}>
              {prepend && <>{prepend}{" "}</>}
              <Link
                href={href}
                className="text-blue-600 hover:text-blue-800 underline font-normal decoration-blue-600/30 hover:decoration-blue-800"
              >
                {linkLabel}
              </Link>
            </span>
          );
        }
      });
    } else {
      result.push(node);
    }
  });
  return result;
};

const replaceTextWithLabel = (
  nodes: React.ReactNode[],
  targetText: string,
  labelText: string,
  prepend?: string
) => {
  const result: React.ReactNode[] = [];
  nodes.forEach((node) => {
    if (typeof node === "string") {
      const parts = node.split(targetText);
      parts.forEach((part, index) => {
        if (part) result.push(part);
        if (index < parts.length - 1) {
          result.push(
            <span key={`label-${index}`} className="text-neutral-500 italic font-normal">
              {prepend && <>{prepend}{" "}</>}
              {labelText}
            </span>
          );
        }
      });
    } else {
      result.push(node);
    }
  });
  return result;
};

const replaceTextWithPlain = (
  nodes: React.ReactNode[],
  targetText: string,
  replacementText: string
) => {
  const result: React.ReactNode[] = [];
  nodes.forEach((node) => {
    if (typeof node === "string") {
      const parts = node.split(targetText);
      parts.forEach((part, index) => {
        if (part) result.push(part);
        if (index < parts.length - 1) {
          result.push(replacementText);
        }
      });
    } else {
      result.push(node);
    }
  });
  return result;
};

const boldMemberName = (
  nodes: React.ReactNode[],
  name: string
) => {
  const result: React.ReactNode[] = [];
  nodes.forEach((node) => {
    if (typeof node === "string") {
      const parts = node.split(name);
      parts.forEach((part, index) => {
        if (part) result.push(part);
        if (index < parts.length - 1) {
          result.push(
            <strong key={`bold-${index}`} className="font-semibold text-neutral-900">
              {name}
            </strong>
          );
        }
      });
    } else {
      result.push(node);
    }
  });
  return result;
};

const renderMessageWithLinks = (
  message: string,
  log: AuditLog,
  cardTitle?: string,
  boardTitle?: string,
  listExists?: boolean,
  memberNames: string[] = [],
  isCardModal?: boolean,
  cardArchived?: boolean
) => {
  let elements: React.ReactNode[] = [message];
  const resolvedCardTitle = cardTitle || 
    ((log.entityType === "CARD" && !log.entityTitle.startsWith("detail:")) 
      ? log.entityTitle 
      : getCardTitleFromMessage(message));

  if (!isCardModal) {
    const boardHref = log.boardId ? `/board/${log.boardId}` : null;
    const resolvedCardId = log.cardId || (log.entityType === "CARD" ? log.entityId : null);
    const cardHref = log.boardId && resolvedCardId ? `/board/${log.boardId}?cardId=${resolvedCardId}` : null;

    // 1. Handle Card Links / Deleted / Archived notice
    if (resolvedCardId) {
      if (cardHref && cardTitle && !cardArchived) {
        elements = replaceTextWithLink(elements, "thẻ này", cardHref, cardTitle, "thẻ");
        elements = replaceTextWithLink(elements, `"${cardTitle}"`, cardHref, cardTitle);
        elements = replaceTextWithLink(elements, `“${cardTitle}”`, cardHref, cardTitle);
      } else if (resolvedCardTitle) {
        const labelText = cardArchived ? `${resolvedCardTitle} (đã lưu trữ)` : `${resolvedCardTitle} (đã bị xóa)`;
        elements = replaceTextWithLabel(elements, "thẻ này", labelText, "thẻ");
        elements = replaceTextWithLabel(elements, `"${resolvedCardTitle}"`, labelText);
        elements = replaceTextWithLabel(elements, `“${resolvedCardTitle}”`, labelText);
      } else {
        const labelText = cardArchived ? "(đã lưu trữ)" : "(đã bị xóa)";
        elements = replaceTextWithLabel(elements, "thẻ này", labelText, "thẻ");
      }
    }

    // 2. Handle Board Links / Deleted notice
    const resolvedBoardTitle = boardTitle || 
      ((log.entityType === "BOARD" && !log.entityTitle.startsWith("detail:")) 
        ? log.entityTitle 
        : getBoardTitleFromMessage(message));
    if (log.boardId) {
      if (boardHref && boardTitle) {
        elements = replaceTextWithLink(elements, `"${boardTitle}"`, boardHref, boardTitle);
        elements = replaceTextWithLink(elements, `“${boardTitle}”`, boardHref, boardTitle);
      } else if (resolvedBoardTitle) {
        elements = replaceTextWithLabel(elements, `"${resolvedBoardTitle}"`, `${resolvedBoardTitle} (đã bị xóa)`);
        elements = replaceTextWithLabel(elements, `“${resolvedBoardTitle}”`, `${resolvedBoardTitle} (đã bị xóa)`);
      }
    }

    // 3. Handle List Links / Deleted notice
    if (log.entityType === "LIST") {
      const listTitle = log.entityTitle;
      const resolvedListTitle = !listTitle.startsWith("detail:") ? listTitle : null;
      if (boardHref && listExists && resolvedListTitle) {
        elements = replaceTextWithLink(elements, `"${resolvedListTitle}"`, boardHref, resolvedListTitle);
        elements = replaceTextWithLink(elements, `“${resolvedListTitle}”`, boardHref, resolvedListTitle);
      } else if (resolvedListTitle) {
        elements = replaceTextWithLabel(elements, `"${resolvedListTitle}"`, `${resolvedListTitle} (đã bị xóa)`);
        elements = replaceTextWithLabel(elements, `“${resolvedListTitle}”`, `${resolvedListTitle} (đã bị xóa)`);
      }
    }
  } else {
    // Inside card modal: replace card title with "này"
    if (resolvedCardTitle) {
      elements = replaceTextWithPlain(elements, `"${resolvedCardTitle}"`, "này");
      elements = replaceTextWithPlain(elements, `“${resolvedCardTitle}”`, "này");
    }
  }

  // 4. Bold member names in the message (longest first to avoid substring matching issues)
  const sortedNames = [...memberNames]
    .filter((name) => name && name !== log.userName)
    .sort((a, b) => b.length - a.length);

  sortedNames.forEach((name) => {
    elements = boldMemberName(elements, name);
  });

  return <>{elements}</>;
};

export const ActivityItem = ({
  data,
  boardTitle,
  cardTitle,
  cardArchived = false,
  listExists = true,
  memberNames = [],
  isCardModal = false,
}: ActivityItemProps) => {
  const initials = data.userName
    ? data.userName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "?";

  const boardHref = data.boardId ? `/board/${data.boardId}` : null;
  let message = generateLogMessage(data);
  if (isCardModal) {
    message = message.replace(/(?:(trong|vào|khỏi|cho)\s+)?thẻ\s+["“][^"”]+["”]/g, (match, prep) => prep ? `${prep} thẻ này` : "thẻ này");
  }

  return (
    <li className="flex items-start gap-x-3.5 py-1">
      <Avatar className="h-9 w-9 flex-shrink-0 mt-0.5">
        <AvatarImage src={data.userImage} alt={data.userName} />
        <AvatarFallback className="text-sm bg-violet-100 text-violet-700 font-medium">
          {initials}
        </AvatarFallback>
      </Avatar>
      <div className="flex flex-col gap-y-1 min-w-0">
        <p className="text-[15px] text-neutral-700 leading-relaxed">
          <span className="font-semibold text-neutral-900">
            {data.userName}
          </span>{" "}
          {renderMessageWithLinks(message, data, cardTitle, boardTitle, listExists, memberNames, isCardModal, cardArchived)}
        </p>
        <p className="text-xs text-neutral-400 flex items-center gap-x-1.5 mt-0.5">
          <span>{format(new Date(data.createdAt), "HH:mm dd 'thg' M, yyyy")}</span>
          {!isCardModal && data.boardId && (
            <>
              <span className="text-neutral-300">•</span>
              <span>trên bảng</span>
              {boardHref && boardTitle ? (
                <Link
                  href={boardHref}
                  className="text-blue-600 hover:text-blue-800 underline font-semibold decoration-blue-600/30 hover:decoration-blue-800 flex items-center gap-x-0.5"
                >
                  {boardTitle}
                </Link>
              ) : (
                <span className="text-neutral-500 italic font-semibold">
                  (đã bị xóa)
                </span>
              )}
              <Users className="h-3.5 w-3.5 text-neutral-400 ml-0.5" />
            </>
          )}
        </p>
      </div>
    </li>
  );
};
