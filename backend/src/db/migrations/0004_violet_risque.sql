CREATE TABLE `notes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`campaign_id` integer NOT NULL,
	`author_user_id` integer NOT NULL,
	`title` text NOT NULL,
	`content_md` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`author_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
