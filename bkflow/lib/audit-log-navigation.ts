import type { AuditLog } from "@prisma/client";

type NavigableAuditLog = Pick<AuditLog, "boardId" | "cardId">;

export const getAuditLogHref = (log: NavigableAuditLog) => {
  if (!log.boardId) {
    return null;
  }

  const boardHref = `/board/${encodeURIComponent(log.boardId)}`;

  if (log.cardId) {
    return `${boardHref}?cardId=${encodeURIComponent(log.cardId)}`;
  }

  return boardHref;
};
