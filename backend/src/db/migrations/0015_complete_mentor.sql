ALTER TABLE `characters` ADD `share_token` text;--> statement-breakpoint
CREATE UNIQUE INDEX `characters_share_token_unique` ON `characters` (`share_token`);