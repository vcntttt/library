import { describe, expect, it } from "vitest";
import type { Obra } from "@/lib/types";
import {
	getMangaReleaseSummary,
	getObraMetaLine,
	isMetadataFinished,
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
	it("reconoce estados externos finalizados", () => {
		expect(isMetadataFinished("Ended")).toBe(true);
		expect(isMetadataFinished("FINISHED")).toBe(true);
		expect(isMetadataFinished("Returning Series")).toBe(false);
		expect(isMetadataFinished(undefined)).toBe(false);
	});

	it("shows audiobook format and duration for consumed biographies", () => {
		const biographies: Obra[] = [
			{
				id: "elon-musk",
				title: "Elon Musk",
				type: "book",
				format: "audiobook",
				status: "finished",
				tags: [],
				quotes: [],
				progress: { current: 801, total: 801 },
				metadata: { pages: 688 },
				createdAt: Date.now(),
				updatedAt: Date.now(),
			},
			{
				id: "steve-jobs",
				title: "Steve Jobs",
				type: "book",
				format: "audiobook",
				status: "finished",
				tags: [],
				quotes: [],
				progress: { current: 915, total: 915 },
				metadata: { pages: 656 },
				createdAt: Date.now(),
				updatedAt: Date.now(),
			},
		];

		expect(getObraMetaLine(biographies[0])).toBe("Audiolibro • 13 h 21 min");
		expect(getObraMetaLine(biographies[1])).toBe("Audiolibro • 15 h 15 min");
	});

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
