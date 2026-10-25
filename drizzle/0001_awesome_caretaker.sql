CREATE TABLE `flashcard_reviews` (
	`user_id` text NOT NULL,
	`id` text NOT NULL,
	`card_id` text NOT NULL,
	`reviewed_at` text NOT NULL,
	`payload` text NOT NULL,
	PRIMARY KEY(`user_id`, `id`)
);
--> statement-breakpoint
CREATE INDEX `flashcard_reviews_date` ON `flashcard_reviews` (`user_id`,`reviewed_at`);--> statement-breakpoint
CREATE TABLE `flashcard_settings` (
	`user_id` text PRIMARY KEY NOT NULL,
	`payload` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `flashcard_transfers` (
	`user_id` text NOT NULL,
	`id` text NOT NULL,
	`recorded_at` text NOT NULL,
	`payload` text NOT NULL,
	PRIMARY KEY(`user_id`, `id`)
);
--> statement-breakpoint
CREATE TABLE `flashcards` (
	`user_id` text NOT NULL,
	`id` text NOT NULL,
	`deck` text NOT NULL,
	`category` text NOT NULL,
	`mode` text NOT NULL,
	`lemma` text NOT NULL,
	`content` text NOT NULL,
	`schedule` text NOT NULL,
	`due` text NOT NULL,
	`reps` integer DEFAULT 0 NOT NULL,
	`suspended` integer DEFAULT 0 NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`last_event_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `id`)
);
--> statement-breakpoint
CREATE INDEX `flashcards_due` ON `flashcards` (`user_id`,`suspended`,`due`);--> statement-breakpoint
CREATE INDEX `flashcards_deck` ON `flashcards` (`user_id`,`deck`,`category`);