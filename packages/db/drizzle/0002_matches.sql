CREATE TABLE "match_players" (
	"match_id" uuid NOT NULL,
	"user_id" text,
	"seat" integer NOT NULL,
	"result" text,
	"placement" integer,
	"win_share" numeric(8, 6) NOT NULL,
	"details" jsonb,
	CONSTRAINT "match_players_match_id_seat_pk" PRIMARY KEY("match_id","seat")
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" uuid PRIMARY KEY NOT NULL,
	"game_id" text NOT NULL,
	"module_version" integer NOT NULL,
	"config" jsonb NOT NULL,
	"seed" "bytea" NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone NOT NULL,
	"status" text NOT NULL,
	"ranked" boolean NOT NULL,
	"player_count" integer NOT NULL,
	"actions" jsonb,
	CONSTRAINT "matches_status_check" CHECK ("matches"."status" in ('finished', 'abandoned'))
);
--> statement-breakpoint
CREATE TABLE "room_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" uuid NOT NULL,
	"type" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"data" jsonb
);
--> statement-breakpoint
ALTER TABLE "match_players" ADD CONSTRAINT "match_players_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_players" ADD CONSTRAINT "match_players_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "match_players_user_id_idx" ON "match_players" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "matches_game_id_ended_at_idx" ON "matches" USING btree ("game_id","ended_at");--> statement-breakpoint
CREATE INDEX "room_events_room_id_type_idx" ON "room_events" USING btree ("room_id","type");