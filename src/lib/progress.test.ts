import { describe, expect, it } from "vitest";
import {
	formatProgressRemaining,
	formatProgressValue,
	getInitialProgressTotal,
	getProgressTotalFromMetadata,
	getProgressUnitLabel,
	isAudiobook,
} from "./progress";
import type { Obra } from "./types";

const baseObra: Obra = {
	id: "obra-1",
	title: "Obra",
	type: "book",
	status: "in-progress",
	tags: [],
	quotes: [],
	createdAt: 1,
	updatedAt: 1,
};

describe("progress helpers", () => {
	it("uses book pages as the initial progress total", () => {
		expect(
			getInitialProgressTotal({
				...baseObra,
				metadata: { pages: 224 },
			}),
		).toBe(224);
	});

	it("uses audiobook duration instead of book pages from metadata", () => {
		expect(
			getInitialProgressTotal({
				...baseObra,
				format: "audiobook",
				metadata: { pages: 736, durationMinutes: 1473 },
			}),
		).toBe(1473);
		expect(
			getInitialProgressTotal({
				...baseObra,
				format: "audiobook",
				metadata: { pages: 736 },
			}),
		).toBe(0);
	});

	it("does not map book pages as audiobook progress total", () => {
		expect(
			getProgressTotalFromMetadata("book", { pages: 736 }, "audiobook"),
		).toBeUndefined();
	});

	it("keeps the saved progress total over metadata", () => {
		expect(
			getInitialProgressTotal({
				...baseObra,
				metadata: { pages: 224 },
				progress: { current: 12, total: 200 },
			}),
		).toBe(200);
	});

	it("falls back to zero without saved progress or usable metadata", () => {
		expect(getInitialProgressTotal(baseObra)).toBe(0);
	});

	it("maps metadata totals by obra type", () => {
		expect(getProgressTotalFromMetadata("manga", { latestChapter: 18 })).toBe(
			18,
		);
		expect(getProgressTotalFromMetadata("series", { episodes: 10 })).toBe(10);
		expect(getProgressTotalFromMetadata("anime", { episodes: 12 })).toBe(12);
		expect(
			getProgressTotalFromMetadata("movie", { runtime: 120 }),
		).toBeUndefined();
	});

	it("treats Elon Musk and Steve Jobs biographies as book audiobooks", () => {
		const audiobooks: Obra[] = [
			{
				...baseObra,
				id: "elon-musk",
				title: "Elon Musk",
				format: "audiobook",
				progress: { current: 180, total: 801 },
			},
			{
				...baseObra,
				id: "steve-jobs",
				title: "Steve Jobs",
				format: "audiobook",
				progress: { current: 240, total: 915 },
			},
		];

		for (const audiobook of audiobooks) {
			expect(isAudiobook(audiobook)).toBe(true);
			expect(getProgressUnitLabel(audiobook)).toBe("minutos");
			expect(getInitialProgressTotal(audiobook)).toBe(
				audiobook.progress?.total,
			);
		}
		expect(formatProgressValue(801, audiobooks[0])).toBe("13 h 21 min");
		expect(formatProgressValue(915, audiobooks[1])).toBe("15 h 15 min");
		expect(formatProgressRemaining(876, 1622, audiobooks[0])).toBe(
			"12 h 26 min",
		);
		expect(formatProgressRemaining(2000, 1622, audiobooks[0])).toBe("0 min");
	});
});
