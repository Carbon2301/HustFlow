import { AttachmentType, type CardAttachment } from "@prisma/client";
import {
  File,
  FileArchive,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileType,
  Link2,
} from "lucide-react";

export function reorder<T>(list: T[], startIndex: number, endIndex: number) {
  const result = Array.from(list);
  const [removed] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, removed);

  return result;
}

export const compareAttachmentOrder = (a: CardAttachment, b: CardAttachment) => {
  if (a.type !== b.type) {
    return a.type === AttachmentType.LINK ? -1 : 1;
  }

  if (a.order !== b.order) {
    return a.order - b.order;
  }

  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
};

export const getExtension = (attachment: CardAttachment) => {
  const value = `${attachment.name} ${attachment.url}`.toLowerCase();
  const match = value.match(/\.([a-z0-9]+)(?:\?|#|\s|$)/);

  return match?.[1] ?? "";
};

export const isImageAttachment = (attachment: CardAttachment) => {
  if (attachment.type !== AttachmentType.FILE) {
    return false;
  }

  const mimeType = attachment.mimeType?.toLowerCase() ?? "";
  const extension = getExtension(attachment);

  return (
    mimeType.startsWith("image/") ||
    ["avif", "gif", "jpeg", "jpg", "png", "webp"].includes(extension)
  );
};

export const getFileKind = (attachment: CardAttachment) => {
  if (attachment.type === AttachmentType.LINK) {
    return "link";
  }

  const mimeType = attachment.mimeType?.toLowerCase() ?? "";
  const extension = getExtension(attachment);

  if (isImageAttachment(attachment)) {
    return "image";
  }

  if (mimeType.includes("pdf") || extension === "pdf") {
    return "pdf";
  }

  if (
    mimeType.includes("zip") ||
    mimeType.includes("rar") ||
    ["7z", "rar", "tar", "zip"].includes(extension)
  ) {
    return "archive";
  }

  if (
    mimeType.includes("word") ||
    mimeType.includes("document") ||
    ["doc", "docx"].includes(extension)
  ) {
    return "document";
  }

  if (
    mimeType.includes("spreadsheet") ||
    mimeType.includes("excel") ||
    ["csv", "xls", "xlsx"].includes(extension)
  ) {
    return "spreadsheet";
  }

  if (mimeType.startsWith("text/") || ["log", "md", "txt"].includes(extension)) {
    return "text";
  }

  return "file";
};

export const getAttachmentIcon = (attachment: CardAttachment) => {
  const kind = getFileKind(attachment);

  switch (kind) {
    case "link":
      return Link2;
    case "image":
      return FileImage;
    case "pdf":
    case "text":
      return FileText;
    case "archive":
      return FileArchive;
    case "document":
      return FileType;
    case "spreadsheet":
      return FileSpreadsheet;
    default:
      return File;
  }
};
