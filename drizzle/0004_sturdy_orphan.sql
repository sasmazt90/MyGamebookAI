CREATE TABLE `generationJobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bookId` int NOT NULL,
	`status` enum('queued','generating','completed','failed') NOT NULL DEFAULT 'queued',
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`startedAt` timestamp,
	`completedAt` timestamp,
	CONSTRAINT `generationJobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `generationJobs` ADD CONSTRAINT `generationJobs_bookId_books_id_fk` FOREIGN KEY (`bookId`) REFERENCES `books`(`id`) ON DELETE no action ON UPDATE no action;