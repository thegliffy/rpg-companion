CREATE TABLE `custom_content` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`created_by_user_id` integer NOT NULL,
	`name` text NOT NULL,
	`data` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`approved_by_user_id` integer,
	`approved_at` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`approved_by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
