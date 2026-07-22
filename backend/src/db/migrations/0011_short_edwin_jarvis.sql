ALTER TABLE `users` ADD `role` text DEFAULT 'player' NOT NULL;
--> statement-breakpoint
-- Backfill for existing installs: grandfather in anyone who's already a
-- campaign's DM (so they don't lose the ability to create new campaigns),
-- then promote the very first-ever registered account to admin (bootstrap).
UPDATE `users` SET `role` = 'dm' WHERE `id` IN (SELECT DISTINCT `user_id` FROM `campaign_memberships` WHERE `role` = 'dm');
--> statement-breakpoint
UPDATE `users` SET `role` = 'admin' WHERE `id` = (SELECT MIN(`id`) FROM `users`);