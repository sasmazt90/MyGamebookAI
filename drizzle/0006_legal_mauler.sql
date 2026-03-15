ALTER TABLE `generationJobs` ADD `lockedAt` timestamp;--> statement-breakpoint
ALTER TABLE `generationJobs` ADD `lockedBy` varchar(128);--> statement-breakpoint
ALTER TABLE `generationJobs` ADD `leaseExpiresAt` timestamp;--> statement-breakpoint
ALTER TABLE `generationJobs` ADD `attempts` int DEFAULT 0 NOT NULL;