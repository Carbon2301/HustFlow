import type { Label, Prisma } from "@prisma/client";

type SourceCardLabel = {
  label: Label;
};

export const normalizeLabelTitle = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();

export const copyCardLabels = async ({
  tx,
  cardId,
  sourceBoardId,
  targetBoardId,
  cardLabels,
  targetLabels,
}: {
  tx: Prisma.TransactionClient;
  cardId: string;
  sourceBoardId: string;
  targetBoardId: string;
  cardLabels: SourceCardLabel[];
  targetLabels: Label[];
}) => {
  const copiedLabelIds = new Set<string>();
  const targetLabelsById = new Map(targetLabels.map((label) => [label.id, label]));
  const targetLabelsByTitle = new Map(
    targetLabels
      .filter((label) => label.title.trim().length > 0)
      .map((label) => [normalizeLabelTitle(label.title), label]),
  );
  const targetEmptyLabelsByColor = new Map(
    targetLabels
      .filter((label) => label.title.trim().length === 0)
      .map((label) => [label.color, label]),
  );

  for (const cardLabel of cardLabels) {
    const sourceLabel = cardLabel.label;
    let targetLabel = sourceBoardId === targetBoardId
      ? targetLabelsById.get(sourceLabel.id)
      : null;

    if (!targetLabel) {
      if (sourceLabel.title.trim().length > 0) {
        targetLabel = targetLabelsByTitle.get(normalizeLabelTitle(sourceLabel.title)) ?? null;
      } else {
        targetLabel = targetEmptyLabelsByColor.get(sourceLabel.color) ?? null;
      }
    }

    if (!targetLabel) {
      targetLabel = await tx.label.create({
        data: {
          boardId: targetBoardId,
          title: sourceLabel.title,
          color: sourceLabel.color,
        },
      });

      if (targetLabel.title.trim().length > 0) {
        targetLabelsByTitle.set(normalizeLabelTitle(targetLabel.title), targetLabel);
      } else {
        targetEmptyLabelsByColor.set(targetLabel.color, targetLabel);
      }
    }

    if (copiedLabelIds.has(targetLabel.id)) {
      continue;
    }

    copiedLabelIds.add(targetLabel.id);
    await tx.cardLabel.create({
      data: {
        cardId,
        labelId: targetLabel.id,
      },
    });
  }
};
