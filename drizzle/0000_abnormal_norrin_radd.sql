CREATE TABLE `campaigns` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`message_content` text,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `media_uploads` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`file_name` text NOT NULL,
	`file_type` text NOT NULL,
	`r2_url` text NOT NULL,
	`uploaded_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `message_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`session_id` text NOT NULL,
	`message_content` text,
	`status` text DEFAULT 'sent' NOT NULL,
	`timestamp` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)),
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`plan_id` text NOT NULL,
	`amount_in_inr` integer NOT NULL,
	`months_paid` integer NOT NULL,
	`transaction_id` text NOT NULL,
	`paid_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)),
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`plan_id`) REFERENCES `plans`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payments_transaction_id_unique` ON `payments` (`transaction_id`);--> statement-breakpoint
CREATE TABLE `plans` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`price_in_inr` integer NOT NULL,
	`max_sessions` integer NOT NULL,
	`description` text,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `plans_name_unique` ON `plans` (`name`);--> statement-breakpoint
CREATE TABLE `servers` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`platform_name` text NOT NULL,
	`server_url` text NOT NULL,
	`api_key` text NOT NULL,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`phone_number` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`session_name` text,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text,
	`password` text NOT NULL,
	`plan_id` text,
	`role` text DEFAULT 'user' NOT NULL,
	`personal_access_token` text NOT NULL,
	`account_expires_at` integer NOT NULL,
	`is_active` integer DEFAULT true,
	`created_at` integer DEFAULT (cast((julianday('now') - 2440587.5)*86400000 as integer)),
	FOREIGN KEY (`plan_id`) REFERENCES `plans`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_personal_access_token_unique` ON `users` (`personal_access_token`);