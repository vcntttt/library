import { describe, expect, it } from "vitest";
import {
	mergeAcknowledgedMangaMetadata,
	nextReadProgress,
} from "./notifications";

describe("notification domain helpers", () => {
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

	it("advances read progress without moving backwards", () => {
		expect(
			nextReadProgress({
				currentProgress: 10,
				currentTotal: 20,
				chapter: 12,
			}),
		).toEqual({
			progressCurrent: 12,
			progressTotal: 20,
			alreadyRead: false,
		});

		expect(
			nextReadProgress({
				currentProgress: 15,
				currentTotal: 20,
				chapter: 12,
			}),
		).toEqual({
			progressCurrent: 15,
			progressTotal: 20,
			alreadyRead: true,
		});
	});
});
