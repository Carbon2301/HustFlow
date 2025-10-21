-- DropIndex
DROP INDEX `Notification_dedupeKey_key` ON `Notification`;

-- CreateIndex
CREATE INDEX `Notification_dedupeKey_idx` ON `Notification`(`dedupeKey`);
