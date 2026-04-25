import { describe, expect, it } from "vitest";
import type { Obra } from "@/lib/types";
import {
	getMangaReleaseSummary,
	getObraMetaLine,
	isObraUpToDate,
} from "./format";

function makeManga(overrides: Partial<Obra> = {}): Obra {
	return {
		id: "obra-1",
		title: "Manga",
		type: "manga",
		status: "in-progress",
		tags: [],
		createdAt: Date.now(),
		updatedAt: Date.now(),
		...overrides,
	} as Obra;
}

describe("manga formatting", () => {
	it("prefers latest chapter and volumes in the meta line", () => {
		const obra = makeManga({
			metadata: {
				latestChapter: 24,
				volumes: 4,
				status: "RELEASING",
			},
		});

		expect(getObraMetaLine(obra)).toBe("24 capítulos • En emisión");
	});

	it("builds a manga summary with verification time", () => {
		const now = 1_700_000_000_000;
		const obra = makeManga({
			metadata: {
				latestChapter: 12,
				volumes: 2,
				status: "RELEASING",
				latestChapterCheckedAt: now,
			},
		});

		expect(getMangaReleaseSummary(obra)).toContain("12 capítulos");
		expect(getMangaReleaseSummary(obra)).toContain("2 volúmenes");
		expect(getMangaReleaseSummary(obra)).toContain("En emisión");
	});

	it("marks manga as up to date when current progress matches latest chapter", () => {
		const obra = makeManga({
			progress: { current: 24, total: 24 },
			metadata: {
				latestChapter: 24,
				status: "RELEASING",
			},
		});

		expect(isObraUpToDate(obra)).toBe(true);
	});
});
