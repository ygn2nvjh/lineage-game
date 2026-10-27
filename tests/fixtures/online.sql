CREATE TABLE `proof_state` (
	`id` text PRIMARY KEY NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`data` text NOT NULL
);

CREATE TABLE `online_players` (
	`owner` text PRIMARY KEY NOT NULL,
	`id` text NOT NULL,
	`data` text NOT NULL,
	`room_code` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `online_players_id_unique` ON `online_players` (`id`);--> statement-breakpoint
CREATE TABLE `online_rooms` (
	`code` text PRIMARY KEY NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`data` text NOT NULL,
	`expires_at` integer NOT NULL
);
