CREATE TABLE `campaign_memberships` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`campaign_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`role` text NOT NULL,
	`joined_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `campaign_user_unique` ON `campaign_memberships` (`campaign_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `campaigns` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`owner_user_id` integer NOT NULL,
	`invite_code` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `campaigns_invite_code_unique` ON `campaigns` (`invite_code`);