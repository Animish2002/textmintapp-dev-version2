PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`phone_number` text NOT NULL,
	`status` text DEFAULT 'disconnected' NOT NULL,
	`session_name` text,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)),
	`wasender_session_id` text,
	`wasender_api_key` text,
	`qr_code` text,
	`last_active_at` integer,
	`account_protection` integer DEFAULT true,
	`log_messages` integer DEFAULT true,
	`read_incoming_messages` integer DEFAULT false,
	`webhook_enabled` integer DEFAULT false,
	`webhook_url` text,
	`webhook_secret` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_sessions`("id", "user_id", "phone_number", "status", "session_name", "created_at", "wasender_session_id", "wasender_api_key", "qr_code", "last_active_at", "account_protection", "log_messages", "read_incoming_messages", "webhook_enabled", "webhook_url", "webhook_secret") SELECT "id", "user_id", "phone_number", "status", "session_name", "created_at", "wasender_session_id", "wasender_api_key", "qr_code", "last_active_at", "account_protection", "log_messages", "read_incoming_messages", "webhook_enabled", "webhook_url", "webhook_secret" FROM `sessions`;--> statement-breakpoint
DROP TABLE `sessions`;--> statement-breakpoint
ALTER TABLE `__new_sessions` RENAME TO `sessions`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_wasender_session_id_unique` ON `sessions` (`wasender_session_id`);--> statement-breakpoint
ALTER TABLE `users` ADD `wasender_user_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `users_wasender_user_id_unique` ON `users` (`wasender_user_id`);