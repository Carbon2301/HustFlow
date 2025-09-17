import { ACTION, AuditLog } from "@prisma/client";

const translateEntityType = (type: string) => {
  switch (type) {
    case "BOARD":
      return "bảng";
    case "LIST":
      return "danh sách";
    case "CARD":
      return "thẻ";
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
      return `đã tạo ${translateEntityType(entityType)} "${entityTitle}"`;
    case ACTION.UPDATE:
      return `đã cập nhật ${translateEntityType(entityType)} "${entityTitle}"`;
    case ACTION.DELETE:
      return `đã xóa ${translateEntityType(entityType)} "${entityTitle}"`;
    default:
      return `hành động không xác định trên ${translateEntityType(entityType)} "${entityTitle}"`;
  };
};