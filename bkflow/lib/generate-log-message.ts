import { ACTION, AuditLog } from "@prisma/client";

const translateEntityType = (type: string) => {
  switch (type) {
    case "BOARD":
      return "bang";
    case "LIST":
      return "danh sach";
    case "CARD":
      return "the";
    case "CHECKLIST":
      return "danh sach cong viec";
    case "CHECKLIST_ITEM":
      return "muc cong viec";
    default:
      return type.toLowerCase();
  }
};

export const generateLogMessage = (log: AuditLog) => {
  const { action, entityTitle, entityType } = log;

  if (entityTitle.startsWith("detail:")) {
    return entityTitle.substring(7);
  }

  switch (action) {
    case ACTION.CREATE:
      return `da tao ${translateEntityType(entityType)} "${entityTitle}"`;
    case ACTION.UPDATE:
      return `da cap nhat ${translateEntityType(entityType)} "${entityTitle}"`;
    case ACTION.DELETE:
      return `da xoa ${translateEntityType(entityType)} "${entityTitle}"`;
    default:
      return `hanh dong khong xac dinh tren ${translateEntityType(entityType)} "${entityTitle}"`;
  }
};
