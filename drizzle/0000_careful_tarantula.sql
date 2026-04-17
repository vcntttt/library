CREATE TYPE "public"."latest_chapter_source" AS ENUM('manga-plus', 'mangadex', 'anilist');--> statement-breakpoint
CREATE TYPE "public"."notification_event_type" AS ENUM('manga.release');--> statement-breakpoint
CREATE TYPE "public"."notification_status" AS ENUM('pending', 'delivered');--> statement-breakpoint
CREATE TYPE "public"."obra_status" AS ENUM('backlog', 'in-progress', 'finished', 'dropped');--> statement-breakpoint
CREATE TYPE "public"."obra_type" AS ENUM('book', 'movie', 'series', 'anime', 'manga');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_events" (
	"id" text PRIMARY KEY NOT NULL,
	"event_type" "notification_event_type" NOT NULL,
	"event_id" text NOT NULL,
	"obra_id" text NOT NULL,
	"anilist_id" text NOT NULL,
	"title" text NOT NULL,
	"chapter" integer NOT NULL,
	"source" "latest_chapter_source" NOT NULL,
	"url" text,
	"detected_at" bigint NOT NULL,
	"status" "notification_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_attempt_at" bigint,
	"delivered_at" bigint,
	"last_error" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "obras" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"type" "obra_type" NOT NULL,
	"status" "obra_status" NOT NULL,
	"review" text,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notes" text,
	"obsidian_path" text,
	"reading_url" text,
	"external_source" text,
	"external_id" text,
	"metadata" jsonb,
	"cover_url" text,
	"creator" text,
	"year" integer,
	"progress_current" integer,
	"progress_total" integer,
	"started_at" bigint,
	"finished_at" bigint,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "obras" ADD CONSTRAINT "obras_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_events_event_id_idx" ON "notification_events" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "notification_events_status_created_at_idx" ON "notification_events" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "obras_user_updated_at_idx" ON "obras" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "obras_user_status_updated_at_idx" ON "obras" USING btree ("user_id","status","updated_at");--> statement-breakpoint
CREATE INDEX "obras_user_type_updated_at_idx" ON "obras" USING btree ("user_id","type","updated_at");--> statement-breakpoint
CREATE INDEX "session_user_id_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");