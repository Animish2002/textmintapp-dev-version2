CREATE TABLE `campaigns` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`session_id` text,
	`name` text,
	`message` text,
	`media_urls` text,
	`created_at` integer DEFAULT strftime('%s', 'now'),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `media` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`file_name` text,
	`file_type` text,
	`r2_url` text,
	`created_at` integer DEFAULT strftime('%s', 'now'),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`amount` integer NOT NULL,
	`plan` text NOT NULL,
	`months_paid` integer DEFAULT 1,
	`payment_date` integer DEFAULT strftime('%s', 'now'),
	`valid_till` integer NOT NULL,
	`payment_method` text,
	`transaction_id` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `reports` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`campaign_id` text,
	`success_count` integer DEFAULT 0,
	`failure_count` integer DEFAULT 0,
	`details` text,
	`generated_at` integer DEFAULT strftime('%s', 'now'),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`phone_number` text,
	`wa_api_key` text,
	`status` text DEFAULT 'active',
	`created_at` integer DEFAULT strftime('%s', 'now'),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`email` text NOT NULL,
	`password` text NOT NULL,
	`personal_access_token` text NOT NULL,
	`plan` text DEFAULT 'basic' NOT NULL,
	`is_active` integer DEFAULT 1,
	`account_valid_till` integer NOT NULL,
	`created_at` integer DEFAULT strftime('%s', 'now')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_personal_access_token_unique` ON `users` (`personal_access_token`);