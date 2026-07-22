PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_dice_rolls` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`campaign_id` integer,
	`user_id` integer NOT NULL,
	`formula` text NOT NULL,
	`label` text,
	`total` integer NOT NULL,
	`breakdown` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_dice_rolls`("id", "campaign_id", "user_id", "formula", "label", "total", "breakdown", "created_at") SELECT "id", "campaign_id", "user_id", "formula", "label", "total", "breakdown", "created_at" FROM `dice_rolls`;--> statement-breakpoint
DROP TABLE `dice_rolls`;--> statement-breakpoint
ALTER TABLE `__new_dice_rolls` RENAME TO `dice_rolls`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_encounters` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`campaign_id` integer,
	`owner_user_id` integer,
	`name` text DEFAULT 'Encounter' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`round` integer DEFAULT 1 NOT NULL,
	`current_turn_index` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_encounters`("id", "campaign_id", "owner_user_id", "name", "is_active", "round", "current_turn_index", "created_at", "updated_at") SELECT "id", "campaign_id", NULL, "name", "is_active", "round", "current_turn_index", "created_at", "updated_at" FROM `encounters`;--> statement-breakpoint
CREATE TABLE `__tmp_combatants` AS SELECT * FROM `combatants`;--> statement-breakpoint
DROP TABLE `combatants`;--> statement-breakpoint
DROP TABLE `encounters`;--> statement-breakpoint
ALTER TABLE `__new_encounters` RENAME TO `encounters`;--> statement-breakpoint
CREATE TABLE `combatants` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`encounter_id` integer NOT NULL,
	`character_id` integer,
	`name` text NOT NULL,
	`initiative` integer NOT NULL,
	`hp_current` integer,
	`hp_max` integer,
	`conditions` text DEFAULT '[]' NOT NULL,
	`sort_order` integer NOT NULL,
	FOREIGN KEY (`encounter_id`) REFERENCES `encounters`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `combatants` SELECT * FROM `__tmp_combatants`;--> statement-breakpoint
DROP TABLE `__tmp_combatants`;--> statement-breakpoint
CREATE TABLE `__new_notes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`campaign_id` integer,
	`author_user_id` integer NOT NULL,
	`title` text NOT NULL,
	`content_md` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`author_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_notes`("id", "campaign_id", "author_user_id", "title", "content_md", "created_at", "updated_at") SELECT "id", "campaign_id", "author_user_id", "title", "content_md", "created_at", "updated_at" FROM `notes`;--> statement-breakpoint
DROP TABLE `notes`;--> statement-breakpoint
ALTER TABLE `__new_notes` RENAME TO `notes`;