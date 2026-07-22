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
CREATE TABLE `encounters` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`campaign_id` integer NOT NULL,
	`name` text DEFAULT 'Encounter' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`round` integer DEFAULT 1 NOT NULL,
	`current_turn_index` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE no action
);
