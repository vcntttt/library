CREATE TABLE "obra_quotes" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"obra_id" text NOT NULL,
	"content" text NOT NULL,
	"character_name" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "obra_quotes" ADD CONSTRAINT "obra_quotes_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "obra_quotes" ADD CONSTRAINT "obra_quotes_obra_id_obras_id_fk" FOREIGN KEY ("obra_id") REFERENCES "public"."obras"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "obra_quotes_user_obra_created_at_idx" ON "obra_quotes" USING btree ("user_id","obra_id","created_at");--> statement-breakpoint
CREATE INDEX "obra_quotes_user_updated_at_idx" ON "obra_quotes" USING btree ("user_id","updated_at");--> statement-breakpoint
ALTER TABLE "obras" DROP COLUMN "notes";