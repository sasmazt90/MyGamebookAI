ALTER TABLE `books` ADD `isFeatured` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `books` ADD `featuredOrder` int DEFAULT 0 NOT NULL;