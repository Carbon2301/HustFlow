export const getExportDateStamp = (date = new Date()) =>
  date.toISOString().slice(0, 10);

export const sanitizeExportFileNamePart = (value: string) => {
  const sanitized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return sanitized || "board";
};

export const buildBoardExportFileName = (
  boardTitle: string,
  suffix: string,
  extension: string,
  date = new Date(),
) => {
  const title = sanitizeExportFileNamePart(boardTitle);
  const stamp = getExportDateStamp(date);

  return `${title}-${suffix}-${stamp}.${extension}`;
};
