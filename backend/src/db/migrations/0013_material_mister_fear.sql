CREATE TABLE `shop_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`shop_id` integer NOT NULL,
	`name` text NOT NULL,
	`base_price` integer DEFAULT 0 NOT NULL,
	`quantity` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`shop_id`) REFERENCES `shops`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `shops` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`campaign_id` integer NOT NULL,
	`is_open` integer DEFAULT false NOT NULL,
	`buy_rate_percent` integer DEFAULT 100 NOT NULL,
	`sell_rate_percent` integer DEFAULT 50 NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `shop_campaign_unique` ON `shops` (`campaign_id`);