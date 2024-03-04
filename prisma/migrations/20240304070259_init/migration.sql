-- CreateTable
CREATE TABLE `Subject` (
    `id` VARCHAR(191) NOT NULL,
    `url` VARCHAR(191) NULL,
    `title` VARCHAR(191) NULL,
    `year` VARCHAR(191) NULL,
    `cover` VARCHAR(191) NULL,
    `summary` VARCHAR(1000) NULL,
    `rating` VARCHAR(191) NULL,
    `pictures` VARCHAR(1000) NULL,
    `director` VARCHAR(191) NULL,
    `screenwriter` VARCHAR(191) NULL,
    `starring` VARCHAR(1000) NULL,
    `type` VARCHAR(191) NULL,
    `area` VARCHAR(191) NULL,
    `language` VARCHAR(191) NULL,
    `releaseDate` VARCHAR(191) NULL,
    `duration` VARCHAR(191) NULL,
    `alias` VARCHAR(191) NULL,
    `IMDb` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Celebrity` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NULL,
    `avatar` VARCHAR(191) NULL,
    `role` VARCHAR(191) NULL,
    `link` VARCHAR(191) NULL,
    `subjectId` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Celebrity` ADD CONSTRAINT `Celebrity_subjectId_fkey` FOREIGN KEY (`subjectId`) REFERENCES `Subject`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
