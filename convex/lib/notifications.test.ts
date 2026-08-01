import { describe, expect, it } from "vitest";
import {
	getNewEpisodeRelease,
	mergeAcknowledgedEpisodeMetadata,
	mergeAcknowledgedMangaMetadata,
	mergeEpisodicMetadata,
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

	it("merges episodic metadata without reducing known counts", () => {
		expect(
			mergeEpisodicMetadata(
				{
					seasons: 3,
					episodes: 30,
					episodesAired: 25,
					lastNotifiedEpisode: 25,
				},
				{
					seasons: 2,
					episodes: 24,
					episodesAired: 24,
					status: "Returning Series",
				},
				1_700_000_000_000,
			),
		).toMatchObject({
			seasons: 3,
			episodes: 30,
			episodesAired: 25,
			lastNotifiedEpisode: 25,
			status: "Returning Series",
		});
	});

	it("detects only genuinely new episodic releases", () => {
		expect(
			getNewEpisodeRelease(
				{ episodesAired: 11, lastNotifiedEpisode: 11 },
				{ episodesAired: 12 },
			),
		).toBe(12);
		expect(
			getNewEpisodeRelease(undefined, { episodesAired: 12 }),
		).toBeUndefined();
	});

	it("acknowledges episodic releases without moving backwards", () => {
		expect(
			mergeAcknowledgedEpisodeMetadata(
				{ episodesAired: 12, lastNotifiedEpisode: 12 },
				11,
				1_700_000_000_000,
			),
		).toMatchObject({
			episodesAired: 12,
			lastNotifiedEpisode: 12,
		});
	});
});
