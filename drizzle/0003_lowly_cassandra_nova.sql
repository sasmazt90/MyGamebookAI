CREATE TABLE `bookReports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bookId` int NOT NULL,
	`reporterUserId` int NOT NULL,
	`reason` varchar(255) NOT NULL,
	`status` enum('pending','resolved') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `bookReports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `stripeEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`eventId` varchar(255) NOT NULL,
	`eventType` varchar(100) NOT NULL,
	`processedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `stripeEvents_id` PRIMARY KEY(`id`),
	CONSTRAINT `stripeEvents_eventId_unique` UNIQUE(`eventId`)
);
--> statement-breakpoint
ALTER TABLE `bookReports` ADD CONSTRAINT `bookReports_bookId_books_id_fk` FOREIGN KEY (`bookId`) REFERENCES `books`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bookReports` ADD CONSTRAINT `bookReports_reporterUserId_users_id_fk` FOREIGN KEY (`reporterUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;