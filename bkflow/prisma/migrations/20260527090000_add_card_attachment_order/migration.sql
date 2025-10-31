-- Add independent ordering support for LINK and FILE attachments on each card.
ALTER TABLE `CardAttachment` ADD COLUMN `order` INTEGER NOT NULL DEFAULT 0;

UPDATE `CardAttachment` AS `attachment`
INNER JOIN (
  SELECT
    `id`,
    ROW_NUMBER() OVER (
      PARTITION BY `cardId`, `type`
      ORDER BY `createdAt` DESC, `id` ASC
    ) - 1 AS `nextOrder`
  FROM `CardAttachment`
) AS `ranked`
ON `ranked`.`id` = `attachment`.`id`
SET `attachment`.`order` = `ranked`.`nextOrder`;
