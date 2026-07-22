PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_characters` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`campaign_id` integer,
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
--> statement-breakpoint
INSERT INTO `__new_characters`("id", "campaign_id", "owner_user_id", "name", "hp_current", "hp_max", "notes", "sheet_data", "created_at", "updated_at") SELECT "id", "campaign_id", "owner_user_id", "name", "hp_current", "hp_max", "notes", "sheet_data", "created_at", "updated_at" FROM `characters`;--> statement-breakpoint
DROP TABLE `characters`;--> statement-breakpoint
ALTER TABLE `__new_characters` RENAME TO `characters`;--> statement-breakpoint
PRAGMA foreign_keys=ON;