import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/db/client", () => ({
	db: {
		select: vi.fn(),
		query: {
			obras: {
				findFirst: vi.fn(),
			},
		},
		insert: vi.fn(),
		update: vi.fn(),
		delete: vi.fn(),
	},
}));

let parseCreateObraInput: typeof import("./obras").parseCreateObraInput;
let parseUpdateObraPatch: typeof import("./obras").parseUpdateObraPatch;
let syncMangaProgressTotal: typeof import("./obras").syncMangaProgressTotal;

beforeAll(async () => {
	const mod = await import("./obras");
	parseCreateObraInput = mod.parseCreateObraInput;
	parseUpdateObraPatch = mod.parseUpdateObraPatch;
	syncMangaProgressTotal = mod.syncMangaProgressTotal;
});

describe("obra validation", () => {
	it("accepts manga metadata fields for creation", () => {
		const input = parseCreateObraInput({
			title: "Manga",
			type: "manga",
			status: "backlog",
			metadata: {
				latestChapter: 120,
				volumes: 12,
				latestChapterSource: "anilist",
				latestChapterCheckedAt: 1_700_000_000_000,
			},
		});

		expect(input.type).toBe("manga");
		expect(input.metadata?.latestChapter).toBe(120);
		expect(input.metadata?.volumes).toBe(12);
	});

	it("accepts manga progress patches", () => {
		const patch = parseUpdateObraPatch({
			progress: { current: 8, total: 24 },
			metadata: { latestChapter: 24 },
		});

		expect(patch.progress?.current).toBe(8);
		expect(patch.metadata?.latestChapter).toBe(24);
	});

	it("accepts zero progress as schema input", () => {
		const input = parseCreateObraInput({
			title: "Manga",
			type: "manga",
			status: "backlog",
			progress: { current: 0, total: 24 },
		});

		expect(input.progress?.total).toBe(24);
	});

	it("syncs manga progress totals upward when new chapters arrive", () => {
		expect(syncMangaProgressTotal(872, { latestChapter: 873 }, "manga")).toBe(
			873,
		);
	});

	it("does not create progress for manga rows that do not have one yet", () => {
		expect(
			syncMangaProgressTotal(undefined, { latestChapter: 873 }, "manga"),
		).toBeUndefined();
	});
});
