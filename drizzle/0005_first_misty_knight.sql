ALTER TABLE `profiles` ADD `cachedTotalBooks` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `profiles` ADD `cachedTotalSales` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `profiles` ADD `cachedTotalReviews` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `profiles` ADD `cachedAverageRating` float DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `profiles` ADD `cachedTotalCompletions` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `profiles` ADD `statsUpdatedAt` timestamp DEFAULT (now()) NOT NULL;