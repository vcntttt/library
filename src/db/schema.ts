import { sql } from "drizzle-orm";
import {
	bigint,
	boolean,
	index,
	integer,
	jsonb,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
} from "drizzle-orm/pg-core";
import type {
	MangaChapterSource,
	MetadataSource,
	ObraMetadata,
	ObraStatus,
	ObraType,
} from "@/lib/types";

export const user = pgTable("user", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	email: text("email").notNull().unique(),
	emailVerified: boolean("email_verified").default(false).notNull(),
	image: text("image"),
	createdAt: timestamp("created_at", { withTimezone: true })
		.defaultNow()
		.notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.defaultNow()
		.notNull(),
});

export const session = pgTable(
	"session",
	{
		id: text("id").primaryKey(),
		expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
		token: text("token").notNull().unique(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		ipAddress: text("ip_address"),
		userAgent: text("user_agent"),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
	},
	(table) => [index("session_user_id_idx").on(table.userId)],
);

export const account = pgTable(
	"account",
	{
		id: text("id").primaryKey(),
		accountId: text("account_id").notNull(),
		providerId: text("provider_id").notNull(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		accessToken: text("access_token"),
		refreshToken: text("refresh_token"),
		idToken: text("id_token"),
		accessTokenExpiresAt: timestamp("access_token_expires_at", {
			withTimezone: true,
		}),
		refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
			withTimezone: true,
		}),
		scope: text("scope"),
		password: text("password"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [index("account_user_id_idx").on(table.userId)],
);

export const verification = pgTable(
	"verification",
	{
		id: text("id").primaryKey(),
		identifier: text("identifier").notNull(),
		value: text("value").notNull(),
		expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const obraTypeEnum = pgEnum("obra_type", [
	"book",
	"movie",
	"series",
	"anime",
	"manga",
]);

export const obraStatusEnum = pgEnum("obra_status", [
	"backlog",
	"in-progress",
	"finished",
	"dropped",
]);

export const latestChapterSourceEnum = pgEnum("latest_chapter_source", [
	"manga-plus",
	"mangadex",
	"anilist",
]);

export const notificationEventTypeEnum = pgEnum("notification_event_type", [
	"manga.release",
]);

export const notificationStatusEnum = pgEnum("notification_status", [
	"pending",
	"delivered",
]);

export const obras = pgTable(
	"obras",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		title: text("title").notNull(),
		type: obraTypeEnum("type").$type<ObraType>().notNull(),
		status: obraStatusEnum("status").$type<ObraStatus>().notNull(),
		review: text("review"),
		tags: jsonb("tags").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
		notes: text("notes"),
		obsidianPath: text("obsidian_path"),
		readingUrl: text("reading_url"),
		externalSource: text("external_source").$type<MetadataSource>(),
		externalId: text("external_id"),
		metadata: jsonb("metadata").$type<ObraMetadata>(),
		coverUrl: text("cover_url"),
		creator: text("creator"),
		year: integer("year"),
		progressCurrent: integer("progress_current"),
		progressTotal: integer("progress_total"),
		startedAt: bigint("started_at", { mode: "number" }),
		finishedAt: bigint("finished_at", { mode: "number" }),
		createdAt: bigint("created_at", { mode: "number" }).notNull(),
		updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
	},
	(table) => [
		index("obras_user_updated_at_idx").on(table.userId, table.updatedAt),
		index("obras_user_status_updated_at_idx").on(
			table.userId,
			table.status,
			table.updatedAt,
		),
		index("obras_user_type_updated_at_idx").on(
			table.userId,
			table.type,
			table.updatedAt,
		),
	],
);

export interface MangaReleasePayload {
	type: "manga.release";
	eventId: string;
	obraId: string;
	anilistId: string;
	title: string;
	chapter: number;
	source: MangaChapterSource;
	url?: string;
	detectedAt: number;
}

export const notificationEvents = pgTable(
	"notification_events",
	{
		id: text("id").primaryKey(),
		eventType: notificationEventTypeEnum("event_type").notNull(),
		eventId: text("event_id").notNull(),
		obraId: text("obra_id").notNull(),
		anilistId: text("anilist_id").notNull(),
		title: text("title").notNull(),
		chapter: integer("chapter").notNull(),
		source: latestChapterSourceEnum("source")
			.$type<MangaChapterSource>()
			.notNull(),
		url: text("url"),
		detectedAt: bigint("detected_at", { mode: "number" }).notNull(),
		status: notificationStatusEnum("status").notNull().default("pending"),
		attempts: integer("attempts").notNull().default(0),
		lastAttemptAt: bigint("last_attempt_at", { mode: "number" }),
		deliveredAt: bigint("delivered_at", { mode: "number" }),
		lastError: text("last_error"),
		createdAt: bigint("created_at", { mode: "number" }).notNull(),
		updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
	},
	(table) => [
		uniqueIndex("notification_events_event_id_idx").on(table.eventId),
		index("notification_events_status_created_at_idx").on(
			table.status,
			table.createdAt,
		),
	],
);

export const schema = {
	user,
	session,
	account,
	verification,
	obras,
	notificationEvents,
};
