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
		transaction: vi.fn(),
	},
}));

let parseCreateObraInput: typeof import("./obras").parseCreateObraInput;
let parseUpdateObraPatch: typeof import("./obras").parseUpdateObraPatch;
let createObra: typeof import("./obras").createObra;
let listObras: typeof import("./obras").listObras;
let updateObra: typeof import("./obras").updateObra;
let toObra: typeof import("./obras").toObra;
let syncMangaProgressTotal: typeof import("./obras").syncMangaProgressTotal;

beforeAll(async () => {
	const mod = await import("./obras");
	parseCreateObraInput = mod.parseCreateObraInput;
	parseUpdateObraPatch = mod.parseUpdateObraPatch;
	createObra = mod.createObra;
	listObras = mod.listObras;
	updateObra = mod.updateObra;
	toObra = mod.toObra;
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

	it("accepts quote patches", () => {
		const patch = parseUpdateObraPatch({
			quotes: [
				{
					id: "quote-1",
					content: "  Es mejor que la primera.  ",
					characterName: "Padme",
				},
			],
		});

		expect(patch.quotes?.[0]?.content).toBe("Es mejor que la primera.");
		expect(patch.quotes?.[0]?.characterName).toBe("Padme");
	});

	it("rejects empty quote content", () => {
		expect(() =>
			parseUpdateObraPatch({
				quotes: [{ content: "   ", characterName: "Padme" }],
			}),
		).toThrow();
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
		expect(obra.quotes).toEqual([]);
	});

	it("lists obras without passing array indexes as quote rows", async () => {
		const limit = vi.fn(async () => [baseRow]);
		vi.mocked(db.select).mockReturnValue({
			from: vi.fn(() => ({
				where: vi.fn(() => ({
					orderBy: vi.fn(() => ({
						limit,
					})),
				})),
			})),
		} as never);

		const obras = await listObras("user-1");

		expect(limit).toHaveBeenCalledWith(200);
		expect(obras).toEqual([
			expect.objectContaining({ id: "obra-1", quotes: [] }),
		]);
	});

	it("replaces quotes within the obra user scope", async () => {
		const existingQuote = {
			id: "quote-1",
			userId: "user-1",
			obraId: "obra-1",
			content: "Old quote",
			characterName: "Old",
			createdAt: 100,
			updatedAt: 100,
		};
		const nextQuotes = [
			{
				...existingQuote,
				content: "Es mejor que la primera.",
				characterName: "Padme",
				updatedAt: 200,
			},
			{
				id: "quote-2",
				userId: "user-1",
				obraId: "obra-1",
				content: "Otra cita.",
				characterName: null,
				createdAt: 200,
				updatedAt: 200,
			},
		];
		const selectResults = [[existingQuote], nextQuotes];
		const insertedValues = vi.fn();
		const deletedWhere = vi.fn();
		const tx = {
			select: vi.fn(() => ({
				from: vi.fn(() => ({
					where: vi.fn(() => ({
						orderBy: vi.fn(async () => selectResults.shift() ?? []),
					})),
				})),
			})),
			update: vi.fn(() => ({
				set: vi.fn(() => ({
					where: vi.fn(() => ({
						returning: vi.fn(async () => [{ ...baseRow, updatedAt: 200 }]),
					})),
				})),
			})),
			delete: vi.fn(() => ({
				where: deletedWhere,
			})),
			insert: vi.fn(() => ({
				values: insertedValues,
			})),
		};
		vi.mocked(db.query.obras.findFirst).mockResolvedValue({
			...baseRow,
			review: "Review",
		});
		vi.mocked(db.transaction).mockImplementation(async (callback) =>
			callback(tx as never),
		);

		const updated = await updateObra("user-1", "obra-1", {
			quotes: [
				{
					id: "quote-1",
					content: "Es mejor que la primera.",
					characterName: "Padme",
				},
				{ id: "quote-2", content: "Otra cita.", characterName: "" },
			],
		});

		expect(deletedWhere).toHaveBeenCalled();
		expect(insertedValues).toHaveBeenCalledWith([
			expect.objectContaining({
				id: "quote-1",
				userId: "user-1",
				obraId: "obra-1",
				content: "Es mejor que la primera.",
				characterName: "Padme",
				createdAt: 100,
			}),
			expect.objectContaining({
				id: "quote-2",
				userId: "user-1",
				obraId: "obra-1",
				content: "Otra cita.",
				characterName: null,
			}),
		]);
		expect(updated.quotes).toEqual([
			expect.objectContaining({
				id: "quote-1",
				content: "Es mejor que la primera.",
				characterName: "Padme",
			}),
			expect.objectContaining({
				id: "quote-2",
				content: "Otra cita.",
				characterName: undefined,
			}),
		]);
	});

	it("returns empty quotes when mapping an obra row without quote rows", () => {
		expect(toObra(baseRow).quotes).toEqual([]);
	});

	it("does not accept notes in update patches", () => {
		const patch = parseUpdateObraPatch({ notes: "legacy" });

		expect("notes" in patch).toBe(false);
	});

	it("stores one date for movies on create", async () => {
		const values = vi.fn((input) => ({
			returning: vi.fn(async () => [{ ...baseRow, ...input }]),
		}));
		vi.mocked(db.insert).mockReturnValue({ values } as never);

		const watchedAt = 1_700_000_000_000;

		await createObra("user-1", {
			title: "Heat",
			type: "movie",
			status: "finished",
			finishedAt: watchedAt,
		});

		expect(values).toHaveBeenCalledWith(
			expect.objectContaining({
				startedAt: watchedAt,
				finishedAt: watchedAt,
			}),
		);
	});

	it("keeps movie start and finish dates synchronized on update", async () => {
		const watchedAt = 1_700_000_000_000;

		vi.mocked(db.query.obras.findFirst).mockResolvedValue({
			...baseRow,
			type: "movie",
			status: "finished",
			startedAt: 1_600_000_000_000,
			finishedAt: 1_600_000_000_000,
		});
		const set = vi.fn((patch) => ({
			where: vi.fn(() => ({
				returning: vi.fn(async () => [{ ...baseRow, type: "movie", ...patch }]),
			})),
		}));
		vi.mocked(db.update).mockReturnValue({ set } as never);

		await updateObra("user-1", "obra-1", {
			finishedAt: watchedAt,
		});

		expect(set).toHaveBeenCalledWith(
			expect.objectContaining({
				startedAt: watchedAt,
				finishedAt: watchedAt,
			}),
		);
	});
});
