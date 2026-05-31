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
  checklistExists?: boolean;
  checklistItemExists?: boolean;
  memberNames?: string[];
  isCardModal?: boolean;
  hideBoardContext?: boolean;
  onNavigate?: () => void;
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
  prepend?: string,
  onNavigate?: () => void,
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
                onClick={onNavigate}
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

const replaceFirstTextWithLink = (
  nodes: React.ReactNode[],
  targetText: string,
  href: string,
  linkLabel: string,
  onNavigate?: () => void,
) => {
  const result: React.ReactNode[] = [];
  let replaced = false;

  nodes.forEach((node) => {
    if (replaced || typeof node !== "string") {
      result.push(node);
      return;
    }

    const index = node.indexOf(targetText);

    if (index === -1) {
      result.push(node);
      return;
    }

    const before = node.slice(0, index);
    const after = node.slice(index + targetText.length);

    if (before) result.push(before);
    result.push(
      <Link
        key={`${href}-${index}`}
        href={href}
        onClick={onNavigate}
        className="text-blue-600 hover:text-blue-800 underline font-normal decoration-blue-600/30 hover:decoration-blue-800"
      >
        {linkLabel}
      </Link>
    );
    if (after) result.push(after);
    replaced = true;
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

const replaceFirstTextWithLabel = (
  nodes: React.ReactNode[],
  targetText: string,
  labelText: string,
) => {
  const result: React.ReactNode[] = [];
  let replaced = false;

  nodes.forEach((node) => {
    if (replaced || typeof node !== "string") {
      result.push(node);
      return;
    }

    const index = node.indexOf(targetText);

    if (index === -1) {
      result.push(node);
      return;
    }

    const before = node.slice(0, index);
    const after = node.slice(index + targetText.length);

    if (before) result.push(before);
    result.push(
      <span key={`label-first-${index}`} className="text-neutral-500 italic font-normal">
        {labelText}
      </span>
    );
    if (after) result.push(after);
    replaced = true;
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

const getFirstQuotedText = (message: string) => {
  const match = message.match(/["“]([^"”]+)["”]/);
  return match ? match[1] : null;
};

const replaceCardMarkers = (
  nodes: React.ReactNode[],
  log: AuditLog,
  isCardModal?: boolean,
  onNavigate?: () => void,
) => {
  const result: React.ReactNode[] = [];
  const markerPattern = /\[card:([^\]|]+)\|([^\]]+)\]/g;

  nodes.forEach((node, nodeIndex) => {
    if (typeof node !== "string") {
      result.push(node);
      return;
    }

    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = markerPattern.exec(node)) !== null) {
      const [marker, cardId, title] = match;

      if (match.index > lastIndex) {
        result.push(node.slice(lastIndex, match.index));
      }

      if (isCardModal) {
        result.push(cardId === log.cardId ? "này" : `"${title}"`);
      } else if (log.boardId) {
        result.push(
          <Link
            key={`card-marker-${nodeIndex}-${cardId}-${match.index}`}
            href={`/board/${log.boardId}?cardId=${cardId}`}
            onClick={onNavigate}
            className="text-blue-600 hover:text-blue-800 underline font-normal decoration-blue-600/30 hover:decoration-blue-800"
          >
            {title}
          </Link>
        );
      } else {
        result.push(title);
      }

      lastIndex = match.index + marker.length;
    }

    if (lastIndex < node.length) {
      result.push(node.slice(lastIndex));
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
  checklistExists?: boolean,
  checklistItemExists?: boolean,
  memberNames: string[] = [],
  isCardModal?: boolean,
  cardArchived?: boolean,
  onNavigate?: () => void,
) => {
  let elements: React.ReactNode[] = [message];
  const hasCardMarkers = /\[card:[^\]|]+\|[^\]]+\]/.test(message);
  const resolvedCardTitle = cardTitle || 
    ((log.entityType === "CARD" && !log.entityTitle.startsWith("detail:")) 
      ? log.entityTitle 
      : getCardTitleFromMessage(message));

  if (hasCardMarkers) {
    elements = replaceCardMarkers(elements, log, isCardModal, onNavigate);
  }

  if (!isCardModal) {
    const boardHref = log.boardId ? `/board/${log.boardId}` : null;
    const resolvedCardId = log.cardId || (log.entityType === "CARD" ? log.entityId : null);
    const cardHref = log.boardId && resolvedCardId ? `/board/${log.boardId}?cardId=${resolvedCardId}` : null;
    const firstQuotedText = getFirstQuotedText(message);

    // 1. Handle Card Links / Deleted / Archived notice
    if (!hasCardMarkers && resolvedCardId) {
      if (cardHref && cardTitle && !cardArchived) {
        elements = replaceTextWithLink(elements, "thẻ này", cardHref, cardTitle, "thẻ", onNavigate);
        elements = replaceTextWithLink(elements, `"${cardTitle}"`, cardHref, cardTitle, undefined, onNavigate);
        elements = replaceTextWithLink(elements, `“${cardTitle}”`, cardHref, cardTitle, undefined, onNavigate);
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
        elements = replaceTextWithLink(elements, `"${boardTitle}"`, boardHref, boardTitle, undefined, onNavigate);
        elements = replaceTextWithLink(elements, `“${boardTitle}”`, boardHref, boardTitle, undefined, onNavigate);
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
        elements = replaceTextWithLink(elements, `"${resolvedListTitle}"`, boardHref, resolvedListTitle, undefined, onNavigate);
        elements = replaceTextWithLink(elements, `“${resolvedListTitle}”`, boardHref, resolvedListTitle, undefined, onNavigate);
      } else if (resolvedListTitle) {
        elements = replaceTextWithLabel(elements, `"${resolvedListTitle}"`, `${resolvedListTitle} (đã bị xóa)`);
        elements = replaceTextWithLabel(elements, `“${resolvedListTitle}”`, `${resolvedListTitle} (đã bị xóa)`);
      }
    }

    // 4. Handle Checklist / Checklist Item Links / Deleted notice
    if (firstQuotedText && log.entityType === "CHECKLIST") {
      if (!checklistExists) {
        elements = replaceFirstTextWithLabel(
          elements,
          `"${firstQuotedText}"`,
          `${firstQuotedText} (Đã bị xóa)`,
        );
        elements = replaceFirstTextWithLabel(
          elements,
          `“${firstQuotedText}”`,
          `${firstQuotedText} (Đã bị xóa)`,
        );
      }
    }

    if (firstQuotedText && log.entityType === "CHECKLIST_ITEM") {
      const checklistItemHref =
        cardHref && !cardArchived && checklistItemExists
          ? `${cardHref}&checklistItemId=${log.entityId}`
          : null;

      if (checklistItemHref) {
        elements = replaceFirstTextWithLink(
          elements,
          `"${firstQuotedText}"`,
          checklistItemHref,
          firstQuotedText,
          onNavigate,
        );
        elements = replaceFirstTextWithLink(
          elements,
          `“${firstQuotedText}”`,
          checklistItemHref,
          firstQuotedText,
          onNavigate,
        );
      } else if (!checklistItemExists) {
        elements = replaceFirstTextWithLabel(
          elements,
          `"${firstQuotedText}"`,
          `${firstQuotedText} (Đã bị xóa)`,
        );
        elements = replaceFirstTextWithLabel(
          elements,
          `“${firstQuotedText}”`,
          `${firstQuotedText} (Đã bị xóa)`,
        );
      }
    }
  } else if (!hasCardMarkers) {
    // Inside card modal: replace card title with "này"
    const isCardRename = log.entityType === "CARD" && log.entityTitle.startsWith("detail:đã đổi tên thẻ thành ");
    if (resolvedCardTitle && !isCardRename) {
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
  checklistExists = true,
  checklistItemExists = true,
  memberNames = [],
  isCardModal = false,
  hideBoardContext = false,
  onNavigate,
}: ActivityItemProps) => {
  const initials = data.userName
    ? data.userName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "?";

  const boardHref = data.boardId ? `/board/${data.boardId}` : null;
  const message = generateLogMessage(data);

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
          {renderMessageWithLinks(message, data, cardTitle, boardTitle, listExists, checklistExists, checklistItemExists, memberNames, isCardModal, cardArchived, onNavigate)}
        </p>
        <p className="text-xs text-neutral-400 flex items-center gap-x-1.5 mt-0.5">
          <span>{format(new Date(data.createdAt), "HH:mm dd 'thg' M, yyyy")}</span>
          {!isCardModal && !hideBoardContext && data.boardId && (
            <>
              <span className="text-neutral-300">•</span>
              <span>trên bảng</span>
              {boardHref && boardTitle ? (
                <Link
                  href={boardHref}
                  onClick={onNavigate}
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
