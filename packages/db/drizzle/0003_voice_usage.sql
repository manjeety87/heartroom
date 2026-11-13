CREATE TABLE "voice_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"joined_at" timestamp with time zone NOT NULL,
	"left_at" timestamp with time zone,
	"minutes" numeric(10, 3)
);
--> statement-breakpoint
CREATE INDEX "voice_usage_joined_at_idx" ON "voice_usage" USING btree ("joined_at");--> statement-breakpoint
CREATE INDEX "voice_usage_room_id_user_id_idx" ON "voice_usage" USING btree ("room_id","user_id");