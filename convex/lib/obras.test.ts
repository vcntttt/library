import { describe, expect, it } from "vitest";
import {
	assertCreateObraInput,
	assertUpdateObraPatch,
	completeProgressForStatus,
	normalizeTags,
	sanitizeMetadata,
	sanitizeProgress,
	sanitizeProgressSeasons,
	shouldReopenFinishedProgress,
	syncMangaProgressTotal,
	syncProgressTotal,
} from "./obras";

describe("obra domain helpers", () => {
	it("rejects empty titles", () => {
		expect(() =>
			assertCreateObraInput({
				title: " ",
				type: "book",
				status: "backlog",
			}),
		).toThrow("titulo");
	});

	it("normalizes tags by trimming, removing empties, and deduping", () => {
		expect(normalizeTags([" manga ", "", "manga", "anime "])).toEqual([
			"manga",
			"anime",
		]);
	});

	it("sanitizes progress without exceeding total", () => {
		expect(sanitizeProgress({ current: 12, total: 10 })).toEqual({
			current: 10,
			total: 10,
		});
	});

	it("sanitizes progress seasons by ordering and removing invalid entries", () => {
		expect(
			sanitizeProgressSeasons([
				{ seasonNumber: 2, episodeCount: 10 },
				{ seasonNumber: 1, episodeCount: 5 },
				{ seasonNumber: 0, episodeCount: 10 },
				{ seasonNumber: -1, episodeCount: 10 },
				{ seasonNumber: 1, episodeCount: -5 },
			]),
		).toEqual([
			{ seasonNumber: 1, episodeCount: 5 },
			{ seasonNumber: 2, episodeCount: 10 },
		]);
	});

	it("deduplicates progress seasons keeping the largest episode count", () => {
		expect(
			sanitizeProgressSeasons([
				{ seasonNumber: 1, episodeCount: 5 },
				{ seasonNumber: 1, episodeCount: 8 },
			]),
		).toEqual([{ seasonNumber: 1, episodeCount: 8 }]);
	});

	it("strips manga-only metadata from non-manga obras", () => {
		expect(
			sanitizeMetadata(
				{
					latestChapter: 120,
					latestChapterSource: "anilist",
					pages: 300,
				},
				"book",
			),
		).toEqual({ pages: 300 });
	});

	it("keeps manga progress totals moving upward", () => {
		expect(syncMangaProgressTotal(872, { latestChapter: 873 }, "manga")).toBe(
			873,
		);
	});

	it("completes progress when an obra is marked as finished", () => {
		expect(
			completeProgressForStatus(
				"finished",
				"manga",
				{ current: 43, total: 45 },
				45,
			),
		).toEqual({ current: 45, total: 45 });
	});

	it("derives a finished progress total from metadata", () => {
		const total = syncProgressTotal(undefined, { episodes: 45 }, "series");
		expect(
			completeProgressForStatus("finished", "series", undefined, total),
		).toEqual({ current: 45, total: 45 });
	});

	it("keeps an in-progress obra incomplete at the known total", () => {
		expect(
			completeProgressForStatus(
				"in-progress",
				"anime",
				{ current: 11, total: 12 },
				12,
			),
		).toEqual({ current: 11, total: 12 });
	});

	it("reopens a finished obra when tracking discovers unconsumed content", () => {
		expect(
			shouldReopenFinishedProgress({
				status: "finished",
				explicitlyFinishing: false,
				trackingChanged: true,
				progress: { current: 12, total: 13 },
			}),
		).toBe(true);
		expect(
			shouldReopenFinishedProgress({
				status: "finished",
				explicitlyFinishing: true,
				trackingChanged: true,
				progress: { current: 12, total: 13 },
			}),
		).toBe(false);
	});

	it("accepts valid quote patches and rejects empty quote content", () => {
		expect(() =>
			assertUpdateObraPatch({
				quotes: [{ content: "  Es mejor que la primera.  " }],
			}),
		).not.toThrow();

		expect(() =>
			assertUpdateObraPatch({ quotes: [{ content: "   " }] }),
		).toThrow("cita");
	});
});
