-- AlterTable
ALTER TABLE `BoardMember` ADD COLUMN `role` ENUM('ADMIN', 'MEMBER') NOT NULL DEFAULT 'MEMBER';

-- Backfill one admin per existing board. The original creator is not stored, so the
-- earliest board member is the safest available existing-data proxy.
UPDATE `BoardMember` bm
INNER JOIN (
    SELECT `boardId`, MIN(`createdAt`) AS `firstCreatedAt`
    FROM `BoardMember`
    GROUP BY `boardId`
) first_member
    ON first_member.`boardId` = bm.`boardId`
    AND first_member.`firstCreatedAt` = bm.`createdAt`
SET bm.`role` = 'ADMIN';
