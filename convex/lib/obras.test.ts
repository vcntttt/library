import { describe, expect, it } from "vitest";
import {
	assertCreateObraInput,
	assertUpdateObraPatch,
	normalizeTags,
	sanitizeMetadata,
	sanitizeProgress,
	syncMangaProgressTotal,
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
