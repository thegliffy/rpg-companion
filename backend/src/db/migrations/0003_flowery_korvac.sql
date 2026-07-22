CREATE TABLE `characters` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`campaign_id` integer NOT NULL,
	`owner_user_id` integer NOT NULL,
	`name` text NOT NULL,
	`hp_current` integer,
	`hp_max` integer,
	`notes` text,
	`sheet_data` text DEFAULT '[]' NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
