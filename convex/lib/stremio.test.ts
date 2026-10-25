import { describe, expect, it } from "vitest";
import {
	getImdbId,
	getImportedStatus,
	mergeImportedProgress,
	mergeImportedWatchMetadata,
	parseStremioEntries,
	parseStremioItems,
	sanitizedStremioError,
	shouldImportStremioItem,
	stremioItemHasStarted,
} from "./stremio";

describe("Stremio API payloads", () => {
	it("no importa pendientes que solo tienen la fecha inicial asignada al agregar a la biblioteca", () => {
		const items = parseStremioItems({
			result: [
				{
					_id: "tt9059760",
					type: "series",
					name: "Normal People",
					removed: false,
					temp: false,
					state: { lastWatched: "2026-10-25T12:00:00Z" },
				},
			],
		});
		expect(items[0] && stremioItemHasStarted(items[0])).toBe(false);
	});

	it("usa el mismo orden binario para continuar después de un cursor con fecha repetida", () => {
		const entries = parseStremioEntries({
			result: [
				["tt1234567:1", 10],
				["tt12345678:1", 10],
			],
		});
		const first = entries[0];
		if (!first) throw new Error("Falta el primer registro de prueba.");
		expect(
			entries.filter(
				(entry) => entry.mtime === first.mtime && entry.id > first.id,
			),
		).toEqual([entries[1]]);
	});

	it("parses the datastore metadata response shape", () => {
		const entries = parseStremioEntries({
			result: [
				["tt0133093:1", "2026-10-24T12:00:00.000Z"],
				["tt0816692:1", "2026-10-24T13:00:00.000Z"],
			],
		});
		expect(entries).toEqual([
			{ id: "tt0133093:1", mtime: Date.parse("2026-10-24T12:00:00.000Z") },
			{ id: "tt0816692:1", mtime: Date.parse("2026-10-24T13:00:00.000Z") },
		]);
	});

	it("accepts valid movie and series datastore items and rejects malformed rows", () => {
		const items = parseStremioItems({
			result: [
				{
					_id: "tt0133093:1",
					name: "The Matrix",
					type: "movie",
					_mtime: "2026-10-24T12:00:00.000Z",
					state: { timeWatched: 90, timeOffset: 45 },
				},
				{
					_id: "tt0903747:1",
					name: "Breaking Bad",
					type: "series",
					state: { time_watched: 20, video_id: "s01e02" },
				},
				{ _id: "bad", name: "Invalid", type: "channel" },
			],
		});
		expect(items).toHaveLength(3);
		expect(items[0]?.state?.timeOffset).toBe(45);
		expect(items[0]?.mtime).toBe(Date.parse("2026-10-24T12:00:00.000Z"));
		expect(items[1]?.state?.video_id).toBe("s01e02");
		expect(() =>
			parseStremioItems({ result: [{ name: "Missing id", type: "movie" }] }),
		).toThrow("elemento de biblioteca inválido");
	});

	it("recognizes started content but does not infer progress from a video id", () => {
		const [movie, series, watchlist] = parseStremioItems({
			result: [
				{
					_id: "tt1",
					name: "Movie",
					type: "movie",
					state: { timeOffset: 0, flaggedWatched: 1 },
				},
				{
					_id: "tt2",
					name: "Series",
					type: "series",
					state: { video_id: "s01e02" },
				},
				{
					_id: "tt3",
					name: "Watchlist only",
					type: "movie",
					removed: true,
					temp: true,
					state: { last_watched: "2026-10-24T12:00:00.000Z" },
				},
			],
		});
		if (!movie || !series || !watchlist)
			throw new Error("Expected all media fixtures.");
		expect(stremioItemHasStarted(movie)).toBe(true);
		expect(stremioItemHasStarted(series)).toBe(false);
		expect(stremioItemHasStarted(watchlist)).toBe(false);
	});
});

describe("Stremio import invariants", () => {
	it("imports only newer updates, making repeat syncs idempotent", () => {
		expect(shouldImportStremioItem(undefined, 10)).toBe(true);
		expect(shouldImportStremioItem(10, 10)).toBe(false);
		expect(shouldImportStremioItem(11, 10)).toBe(false);
		expect(shouldImportStremioItem(10, 11)).toBe(true);
	});

	it("never reduces imported series progress and does not finish a caught-up ongoing series", () => {
		expect(mergeImportedProgress(8, 10, 6, 8)).toEqual({
			current: 8,
			total: 10,
		});
		expect(getImportedStatus("series", false, "Returning Series", 10, 10)).toBe(
			"in-progress",
		);
		expect(getImportedStatus("series", false, "Ended", 10, 10)).toBe(
			"finished",
		);
		expect(getImportedStatus("movie", true)).toBe("finished");
	});

	it("preserves known metadata while refreshing provider availability", () => {
		const merged = mergeImportedWatchMetadata(
			{
				seasons: 3,
				episodes: 42,
				watchProviders: ["Old provider"],
				description: "Manual context",
			},
			{ seasons: 4, episodes: 50, watchProviders: ["Netflix", "Max"] },
		);
		expect(merged).toEqual({
			seasons: 3,
			episodes: 42,
			watchProviders: ["Netflix", "Max"],
			description: "Manual context",
		});
	});

	it("extracts only IMDb IDs and sanitizes rate-limit details", () => {
		expect(getImdbId("tt0133093:1:0")).toBe("tt0133093");
		expect(getImdbId("not-imdb:1")).toBeUndefined();
		expect(sanitizedStremioError(429, "120")).toContain("2 min");
		expect(sanitizedStremioError(401)).not.toContain("authKey");
	});
});
