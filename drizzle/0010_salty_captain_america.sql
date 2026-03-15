CREATE TABLE `notificationThrottle` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`notificationType` varchar(64) NOT NULL,
	`referenceKey` varchar(255) NOT NULL,
	`lastSentAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notificationThrottle_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `notificationThrottle` ADD CONSTRAINT `notificationThrottle_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;