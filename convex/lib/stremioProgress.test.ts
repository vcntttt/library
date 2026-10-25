import { deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { countWatchedEpisodes } from "./stremioProgress";

const videos = [1, 2, 3, 4].map((episode) => ({
	id: `tt0903747:1:${episode}`,
	season: 1,
	episode,
}));
const serialized = `tt0903747:1:3:3:${deflateSync(Uint8Array.of(0b101)).toString("base64")}`;

describe("episodios vistos de Stremio", () => {
	it("cuenta capítulos vistos sin contar los saltados ni suponer que se vieron los anteriores", () => {
		expect(countWatchedEpisodes(serialized, videos)).toBe(2);
	});
	it("mantiene la cuenta cuando se agregan especiales antes del punto de referencia", () => {
		expect(
			countWatchedEpisodes(serialized, [
				{ id: "tt0903747:0:1", season: 0, episode: 1 },
				...videos,
			]),
		).toBe(2);
	});
	it("rechaza progreso corrupto y referencias ausentes", () => {
		expect(() => countWatchedEpisodes("corrupto", videos)).toThrow();
		expect(() => countWatchedEpisodes(serialized, [])).toThrow();
		expect(countWatchedEpisodes("", videos)).toBe(0);
	});
});
