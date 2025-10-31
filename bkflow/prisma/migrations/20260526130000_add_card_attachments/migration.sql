-- CreateTable
CREATE TABLE `CardAttachment` (
    `id` VARCHAR(191) NOT NULL,
    `cardId` VARCHAR(191) NOT NULL,
    `type` ENUM('LINK', 'FILE') NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `url` TEXT NOT NULL,
    `fileKey` VARCHAR(191) NULL,
    `fileSize` INTEGER NULL,
    `mimeType` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `CardAttachment_cardId_idx`(`cardId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `CardAttachment` ADD CONSTRAINT `CardAttachment_cardId_fkey`
    FOREIGN KEY (`cardId`) REFERENCES `Card`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;
