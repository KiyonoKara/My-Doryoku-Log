CREATE TABLE `time_entries` (
	`id` integer PRIMARY KEY NOT NULL,
	`task` text NOT NULL,
	`category` text DEFAULT 'Other' NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text,
	`duration_ms` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` integer PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`amount` real NOT NULL,
	`category` text NOT NULL,
	`type` text NOT NULL,
	`description` text
);
