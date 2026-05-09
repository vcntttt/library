import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db/client";

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
let createObra: typeof import("./obras").createObra;
let updateObra: typeof import("./obras").updateObra;
let syncMangaProgressTotal: typeof import("./obras").syncMangaProgressTotal;

beforeAll(async () => {
	const mod = await import("./obras");
	parseCreateObraInput = mod.parseCreateObraInput;
	parseUpdateObraPatch = mod.parseUpdateObraPatch;
	createObra = mod.createObra;
	updateObra = mod.updateObra;
	syncMangaProgressTotal = mod.syncMangaProgressTotal;
});

beforeEach(() => {
	vi.clearAllMocks();
});

const baseRow = {
	id: "obra-1",
	userId: "user-1",
	title: "Obra",
	type: "book" as const,
	status: "backlog" as const,
	review: null,
	tags: [],
	notes: null,
	recommendedBy: null,
	readingUrl: null,
	externalSource: null,
	externalId: null,
	metadata: null,
	coverUrl: null,
	creator: null,
	year: null,
	progressCurrent: null,
	progressTotal: null,
	startedAt: null,
	finishedAt: null,
	createdAt: 1,
	updatedAt: 1,
};

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

	it("round-trips a recommendedBy value when creating an obra", async () => {
		const values = vi.fn((input) => ({
			returning: vi.fn(async () => [{ ...baseRow, ...input }]),
		}));
		vi.mocked(db.insert).mockReturnValue({ values } as never);

		const obra = await createObra("user-1", {
			title: "Dune",
			type: "book",
			status: "backlog",
			recommendedBy: "Vale",
		});

		expect(values).toHaveBeenCalledWith(
			expect.objectContaining({ recommendedBy: "Vale" }),
		);
		expect(obra.recommendedBy).toBe("Vale");
	});

	it("trims recommendedBy on create and clears it on update", async () => {
		const values = vi.fn((input) => ({
			returning: vi.fn(async () => [{ ...baseRow, ...input }]),
		}));
		vi.mocked(db.insert).mockReturnValue({ values } as never);

		const created = await createObra("user-1", {
			title: "Dune",
			type: "book",
			status: "backlog",
			recommendedBy: "  Reddit  ",
		});

		expect(created.recommendedBy).toBe("Reddit");

		vi.mocked(db.query.obras.findFirst).mockResolvedValue({
			...baseRow,
			recommendedBy: "Reddit",
		});
		const set = vi.fn((patch) => ({
			where: vi.fn(() => ({
				returning: vi.fn(async () => [
					{ ...baseRow, recommendedBy: "Reddit", ...patch },
				]),
			})),
		}));
		vi.mocked(db.update).mockReturnValue({ set } as never);

		const updated = await updateObra("user-1", "obra-1", {
			recommendedBy: "",
		});

		expect(set).toHaveBeenCalledWith(
			expect.objectContaining({ recommendedBy: null }),
		);
		expect(updated.recommendedBy).toBeUndefined();
	});

	it("keeps ordinary backlog obras without recommendations unchanged", async () => {
		const values = vi.fn((input) => ({
			returning: vi.fn(async () => [{ ...baseRow, ...input }]),
		}));
		vi.mocked(db.insert).mockReturnValue({ values } as never);

		const obra = await createObra("user-1", {
			title: "Plain backlog",
			type: "book",
			status: "backlog",
		});

		expect(values).toHaveBeenCalledWith(
			expect.objectContaining({ recommendedBy: null }),
		);
		expect(obra.status).toBe("backlog");
		expect(obra.recommendedBy).toBeUndefined();
	});
});
