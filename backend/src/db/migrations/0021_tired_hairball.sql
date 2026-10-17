CREATE TABLE `npcs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`campaign_id` integer NOT NULL,
	`name` text NOT NULL,
	`role` text DEFAULT '' NOT NULL,
	`appearance` text DEFAULT '' NOT NULL,
	`personality` text DEFAULT '' NOT NULL,
	`motivation` text DEFAULT '' NOT NULL,
	`secret` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`image_filename` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `campaigns` ADD `flavor_rolls` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `custom_content` ADD `image_filename` text;--> statement-breakpoint
ALTER TABLE `dice_rolls` ADD `flavor` text;