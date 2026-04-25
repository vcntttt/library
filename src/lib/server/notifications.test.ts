import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db/client", () => ({
	db: {
		query: {
			notificationEvents: {
				findFirst: vi.fn(),
			},
			obras: {
				findFirst: vi.fn(),
			},
		},
		select: vi.fn(),
		update: vi.fn(),
		insert: vi.fn(),
	},
}));

import { db } from "@/db/client";
import {
	markNotificationChapterRead,
	mergeAcknowledgedMangaMetadata,
} from "./notifications";

const dbMock = vi.mocked(db);

beforeEach(() => {
	vi.clearAllMocks();
});

describe("mergeAcknowledgedMangaMetadata", () => {
	it("keeps manga release metadata in sync when a release is acknowledged", () => {
		const now = 1_700_000_000_000;
		const metadata = mergeAcknowledgedMangaMetadata(
			{
				latestChapter: 120,
				latestChapterCheckedAt: now - 10_000,
				lastNotifiedChapter: 119,
				latestChapterSource: "anilist",
			},
			121,
			now,
		);

		expect(metadata.latestChapter).toBe(121);
		expect(metadata.lastNotifiedChapter).toBe(121);
		expect(metadata.latestChapterCheckedAt).toBe(now - 10_000);
	});

	it("fills missing release metadata from the acknowledged chapter", () => {
		const now = 1_700_000_000_000;
		const metadata = mergeAcknowledgedMangaMetadata(undefined, 382, now);

		expect(metadata.latestChapter).toBe(382);
		expect(metadata.lastNotifiedChapter).toBe(382);
		expect(metadata.latestChapterCheckedAt).toBe(now);
	});
});

describe("markNotificationChapterRead", () => {
	it("marks a chapter as read by advancing manga progress", async () => {
		const updateSet = vi.fn(() => ({ where: vi.fn() }));
		dbMock.update.mockReturnValue({ set: updateSet } as never);
		dbMock.query.notificationEvents.findFirst.mockResolvedValueOnce(
			notificationEvent({ chapter: 12 }),
		);
		dbMock.query.obras.findFirst.mockResolvedValueOnce(
			obra({ progressCurrent: 10, progressTotal: 20 }),
		);

		const result = await markNotificationChapterRead("obra-1:12");

		expect(result).toMatchObject({
			ok: true,
			chapter: 12,
			progressCurrent: 12,
			alreadyRead: false,
		});
		expect(updateSet).toHaveBeenCalledWith(
			expect.objectContaining({
				progressCurrent: 12,
				progressTotal: 20,
			}),
		);
	});

	it("does not move progress backwards when chapter was already read", async () => {
		const updateSet = vi.fn(() => ({ where: vi.fn() }));
		dbMock.update.mockReturnValue({ set: updateSet } as never);
		dbMock.query.notificationEvents.findFirst.mockResolvedValueOnce(
			notificationEvent({ chapter: 12 }),
		);
		dbMock.query.obras.findFirst.mockResolvedValueOnce(
			obra({ progressCurrent: 15, progressTotal: 20 }),
		);

		const result = await markNotificationChapterRead("obra-1:12");

		expect(result).toMatchObject({
			ok: true,
			chapter: 12,
			progressCurrent: 15,
			alreadyRead: true,
		});
		expect(updateSet).toHaveBeenCalledWith(
			expect.objectContaining({
				progressCurrent: 15,
				progressTotal: 20,
			}),
		);
	});

	it("raises progress total when the read chapter is above the current total", async () => {
		const updateSet = vi.fn(() => ({ where: vi.fn() }));
		dbMock.update.mockReturnValue({ set: updateSet } as never);
		dbMock.query.notificationEvents.findFirst.mockResolvedValueOnce(
			notificationEvent({ chapter: 12 }),
		);
		dbMock.query.obras.findFirst.mockResolvedValueOnce(
			obra({ progressCurrent: 10, progressTotal: 10 }),
		);

		await markNotificationChapterRead("obra-1:12");

		expect(updateSet).toHaveBeenCalledWith(
			expect.objectContaining({
				progressCurrent: 12,
				progressTotal: 12,
			}),
		);
	});

	it("returns not_found for an unknown notification event", async () => {
		dbMock.query.notificationEvents.findFirst.mockResolvedValueOnce(undefined);

		const result = await markNotificationChapterRead("missing");

		expect(result).toMatchObject({
			ok: false,
			reason: "not_found",
		});
		expect(dbMock.update).not.toHaveBeenCalled();
	});

	it("returns obra_not_found when the notification points to a missing obra", async () => {
		dbMock.query.notificationEvents.findFirst.mockResolvedValueOnce(
			notificationEvent({ chapter: 12 }),
		);
		dbMock.query.obras.findFirst.mockResolvedValueOnce(undefined);

		const result = await markNotificationChapterRead("obra-1:12");

		expect(result).toMatchObject({
			ok: false,
			reason: "obra_not_found",
		});
		expect(dbMock.update).not.toHaveBeenCalled();
	});

	it("returns not_manga when the notification points to another obra type", async () => {
		dbMock.query.notificationEvents.findFirst.mockResolvedValueOnce(
			notificationEvent({ chapter: 12 }),
		);
		dbMock.query.obras.findFirst.mockResolvedValueOnce(
			obra({ type: "book", progressCurrent: 10, progressTotal: 20 }),
		);

		const result = await markNotificationChapterRead("obra-1:12");

		expect(result).toMatchObject({
			ok: false,
			reason: "not_manga",
		});
		expect(dbMock.update).not.toHaveBeenCalled();
	});
});

function notificationEvent(overrides: Record<string, unknown> = {}) {
	return {
		id: "event-1",
		eventType: "manga.release",
		eventId: "obra-1:12",
		obraId: "obra-1",
		anilistId: "123",
		title: "Test Manga",
		chapter: 12,
		source: "anilist",
		url: null,
		detectedAt: 1_700_000_000_000,
		status: "delivered",
		attempts: 1,
		lastAttemptAt: 1_700_000_000_000,
		deliveredAt: 1_700_000_000_000,
		lastError: null,
		createdAt: 1_700_000_000_000,
		updatedAt: 1_700_000_000_000,
		...overrides,
	} as never;
}

function obra(overrides: Record<string, unknown> = {}) {
	return {
		id: "obra-1",
		userId: "user-1",
		title: "Test Manga",
		type: "manga",
		status: "in-progress",
		review: null,
		tags: [],
		notes: null,
		readingUrl: null,
		externalSource: "anilist",
		externalId: "123",
		metadata: null,
		coverUrl: null,
		creator: null,
		year: null,
		progressCurrent: 10,
		progressTotal: 20,
		startedAt: null,
		finishedAt: null,
		createdAt: 1_700_000_000_000,
		updatedAt: 1_700_000_000_000,
		...overrides,
	} as never;
}
