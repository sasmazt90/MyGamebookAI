CREATE TABLE `audioSettings` (
	`userId` int NOT NULL,
	`isMuted` boolean NOT NULL DEFAULT false,
	`volume` float NOT NULL DEFAULT 0.7,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `audioSettings_userId` PRIMARY KEY(`userId`)
);
--> statement-breakpoint
CREATE TABLE `banners` (
	`id` int AUTO_INCREMENT NOT NULL,
	`imageUrl` text NOT NULL,
	`orderIndex` int NOT NULL DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`ctaLink` varchar(500) NOT NULL DEFAULT '/create',
	`translations` json NOT NULL,
	`startsAt` timestamp,
	`endsAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `banners_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `bookCharacters` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bookId` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`photoUrl` text,
	`orderIndex` int NOT NULL DEFAULT 0,
	CONSTRAINT `bookCharacters_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `bookPages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bookId` int NOT NULL,
	`pageNumber` int NOT NULL,
	`branchPath` varchar(255) NOT NULL DEFAULT 'root',
	`isBranchPage` boolean NOT NULL DEFAULT false,
	`content` text,
	`imageUrl` text,
	`panels` json,
	`choiceA` text,
	`choiceB` text,
	`nextPageIdA` int,
	`nextPageIdB` int,
	`sfxTags` json,
	`format` enum('landscape','portrait') NOT NULL DEFAULT 'portrait',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `bookPages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `books` (
	`id` int AUTO_INCREMENT NOT NULL,
	`authorId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`category` enum('fairy_tale','comic','crime_mystery','fantasy_scifi','romance','horror_thriller') NOT NULL,
	`bookLanguage` varchar(10) NOT NULL DEFAULT 'en',
	`length` enum('thin','normal','thick') NOT NULL,
	`description` text,
	`coverImageUrl` text,
	`status` enum('generating','ready','failed','deleted') NOT NULL DEFAULT 'generating',
	`generationJobId` varchar(255),
	`totalPages` int DEFAULT 0,
	`totalBranches` int DEFAULT 0,
	`isPublished` boolean NOT NULL DEFAULT false,
	`isDelisted` boolean NOT NULL DEFAULT false,
	`storePrice` int,
	`purchaseCount` int NOT NULL DEFAULT 0,
	`reviewCount` int NOT NULL DEFAULT 0,
	`averageRating` float DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `books_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `campaigns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`discountType` enum('percent','fixed') NOT NULL,
	`discountValue` float NOT NULL,
	`targetCategories` json NOT NULL,
	`isActive` boolean NOT NULL DEFAULT false,
	`startsAt` timestamp,
	`endsAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `campaigns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `creditTransactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`type` enum('purchase','spend_generate','spend_buy','earn_sale','admin_adjust','monthly_reward') NOT NULL,
	`amount` int NOT NULL,
	`balanceAfter` int NOT NULL,
	`description` text,
	`referenceId` varchar(255),
	`stripePaymentIntentId` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `creditTransactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `monthlyRewards` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`yearMonth` varchar(7) NOT NULL,
	`creditsAwarded` int NOT NULL DEFAULT 10,
	`rank` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `monthlyRewards_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`type` varchar(64) NOT NULL,
	`title` varchar(255) NOT NULL,
	`message` text NOT NULL,
	`linkUrl` varchar(500),
	`metadataJson` json,
	`isRead` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `profiles` (
	`userId` int NOT NULL,
	`authorName` varchar(30) NOT NULL,
	`authorNameLower` varchar(30) NOT NULL,
	`avatarUrl` text,
	`interfaceLanguage` varchar(10) NOT NULL DEFAULT 'en',
	`onboardingComplete` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `profiles_userId` PRIMARY KEY(`userId`),
	CONSTRAINT `profiles_authorNameLower_unique` UNIQUE(`authorNameLower`)
);
--> statement-breakpoint
CREATE TABLE `readingProgress` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`bookId` int NOT NULL,
	`currentPageId` int,
	`branchPath` varchar(255) NOT NULL DEFAULT 'root',
	`completedAt` timestamp,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `readingProgress_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bookId` int NOT NULL,
	`userId` int NOT NULL,
	`rating` int NOT NULL,
	`reviewText` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `reviews_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `userBooks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`bookId` int NOT NULL,
	`acquiredVia` enum('generated','purchased') NOT NULL,
	`pricePaid` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `userBooks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `wallets` (
	`userId` int NOT NULL,
	`balance` int NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `wallets_userId` PRIMARY KEY(`userId`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `status` enum('active','suspended','deleted') DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `audioSettings` ADD CONSTRAINT `audioSettings_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bookCharacters` ADD CONSTRAINT `bookCharacters_bookId_books_id_fk` FOREIGN KEY (`bookId`) REFERENCES `books`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bookPages` ADD CONSTRAINT `bookPages_bookId_books_id_fk` FOREIGN KEY (`bookId`) REFERENCES `books`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `books` ADD CONSTRAINT `books_authorId_users_id_fk` FOREIGN KEY (`authorId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `creditTransactions` ADD CONSTRAINT `creditTransactions_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `monthlyRewards` ADD CONSTRAINT `monthlyRewards_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `profiles` ADD CONSTRAINT `profiles_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `readingProgress` ADD CONSTRAINT `readingProgress_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `readingProgress` ADD CONSTRAINT `readingProgress_bookId_books_id_fk` FOREIGN KEY (`bookId`) REFERENCES `books`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_bookId_books_id_fk` FOREIGN KEY (`bookId`) REFERENCES `books`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `userBooks` ADD CONSTRAINT `userBooks_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `userBooks` ADD CONSTRAINT `userBooks_bookId_books_id_fk` FOREIGN KEY (`bookId`) REFERENCES `books`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `wallets` ADD CONSTRAINT `wallets_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;