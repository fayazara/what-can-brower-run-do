CREATE TABLE `brand_pages` (
	`domain` text PRIMARY KEY NOT NULL,
	`name` text,
	`logo_url` text,
	`hit_count` integer DEFAULT 1 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
