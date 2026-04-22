import { describe, expect, it, vi } from "vitest";

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

import { mergeAcknowledgedMangaMetadata } from "./notifications";

describe("mergeAcknowledgedMangaMetadata", () => {
	it("keeps manga chapter fields in sync when a release is acknowledged", () => {
		const now = 1_700_000_000_000;
		const metadata = mergeAcknowledgedMangaMetadata(
			{
				chapters: 120,
				latestChapter: 120,
				latestChapterCheckedAt: now - 10_000,
				lastNotifiedChapter: 119,
				latestChapterSource: "anilist",
			},
			121,
			now,
		);

		expect(metadata.chapters).toBe(121);
		expect(metadata.latestChapter).toBe(121);
		expect(metadata.lastNotifiedChapter).toBe(121);
		expect(metadata.latestChapterCheckedAt).toBe(now - 10_000);
	});

	it("fills missing chapter fields from the acknowledged release", () => {
		const now = 1_700_000_000_000;
		const metadata = mergeAcknowledgedMangaMetadata(undefined, 382, now);

		expect(metadata.chapters).toBe(382);
		expect(metadata.latestChapter).toBe(382);
		expect(metadata.lastNotifiedChapter).toBe(382);
		expect(metadata.latestChapterCheckedAt).toBe(now);
	});
});
