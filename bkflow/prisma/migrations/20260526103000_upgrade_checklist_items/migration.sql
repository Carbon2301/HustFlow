-- AlterEnum
ALTER TABLE `AuditLog` MODIFY `entityType` ENUM('BOARD', 'LIST', 'CARD', 'CHECKLIST', 'CHECKLIST_ITEM') NOT NULL;

-- AlterTable
ALTER TABLE `AuditLog` ADD COLUMN `cardId` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `Checklist` ADD COLUMN `order` INTEGER NOT NULL DEFAULT 0;

-- Backfill checklist order per card using existing creation order.
UPDATE `Checklist` checklist
INNER JOIN (
    SELECT
        `id`,
        ROW_NUMBER() OVER (PARTITION BY `cardId` ORDER BY `createdAt` ASC, `id` ASC) - 1 AS `nextOrder`
    FROM `Checklist`
) ranked_checklists
    ON ranked_checklists.`id` = checklist.`id`
SET checklist.`order` = ranked_checklists.`nextOrder`;

-- AlterTable
ALTER TABLE `ChecklistItem`
    ADD COLUMN `dueDate` DATETIME(3) NULL,
    ADD COLUMN `assigneeId` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `AuditLog_cardId_idx` ON `AuditLog`(`cardId`);

-- CreateIndex
CREATE INDEX `ChecklistItem_assigneeId_idx` ON `ChecklistItem`(`assigneeId`);

-- AddForeignKey
ALTER TABLE `ChecklistItem` ADD CONSTRAINT `ChecklistItem_assigneeId_fkey`
    FOREIGN KEY (`assigneeId`) REFERENCES `BoardMember`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;
