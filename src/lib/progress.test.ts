import { describe, expect, it } from "vitest";
import {
	getInitialProgressTotal,
	getProgressTotalFromMetadata,
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
});
