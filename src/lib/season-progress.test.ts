import { describe, expect, it } from "vitest";
import {
	formatSeasonProgress,
	getInitialSeasonsFromMetadata,
	getSeasonEndProgress,
	getSeasonProgress,
	mergeSeasons,
	setSeasonProgress,
	totalEpisodesForSeasons,
	validateSeasons,
} from "./season-progress";

const himymSeasons = [
	{ seasonNumber: 1, episodeCount: 22 },
	{ seasonNumber: 2, episodeCount: 22 },
	{ seasonNumber: 3, episodeCount: 20 },
	{ seasonNumber: 4, episodeCount: 24 },
	{ seasonNumber: 5, episodeCount: 24 },
	{ seasonNumber: 6, episodeCount: 24 },
	{ seasonNumber: 7, episodeCount: 24 },
	{ seasonNumber: 8, episodeCount: 24 },
	{ seasonNumber: 9, episodeCount: 24 },
];

describe("validateSeasons", () => {
	it("ordena por seasonNumber y elimina invalidas", () => {
		const result = validateSeasons([
			{ seasonNumber: 2, episodeCount: 10 },
			{ seasonNumber: 1, episodeCount: 5 },
			{ seasonNumber: 0, episodeCount: 10 },
			{ seasonNumber: -1, episodeCount: 10 },
			{ seasonNumber: 1, episodeCount: -5 },
		]);
		expect(result).toEqual([
			{ seasonNumber: 1, episodeCount: 5 },
			{ seasonNumber: 2, episodeCount: 10 },
		]);
	});

	it("mantiene la mayor episodeCount cuando hay duplicados", () => {
		const result = validateSeasons([
			{ seasonNumber: 1, episodeCount: 5 },
			{ seasonNumber: 1, episodeCount: 8 },
		]);
		expect(result).toEqual([{ seasonNumber: 1, episodeCount: 8 }]);
	});
});

describe("totalEpisodesForSeasons", () => {
	it("suma episodios correctamente", () => {
		expect(totalEpisodesForSeasons(himymSeasons)).toBe(208);
	});
});

describe("mergeSeasons", () => {
	it("agrega temporadas nuevas sin reducir conteos existentes", () => {
		expect(
			mergeSeasons(
				[
					{ seasonNumber: 1, episodeCount: 12 },
					{ seasonNumber: 2, episodeCount: 10 },
				],
				[
					{ seasonNumber: 2, episodeCount: 8 },
					{ seasonNumber: 3, episodeCount: 6 },
				],
			),
		).toEqual([
			{ seasonNumber: 1, episodeCount: 12 },
			{ seasonNumber: 2, episodeCount: 10 },
			{ seasonNumber: 3, episodeCount: 6 },
		]);
	});
});

describe("getSeasonEndProgress", () => {
	it("calcula el progreso acumulado al terminar una temporada", () => {
		expect(getSeasonEndProgress(himymSeasons, 2)).toBe(44);
	});
});

describe("getSeasonProgress", () => {
	it("devuelve null sin temporadas", () => {
		expect(getSeasonProgress([], 40)).toBeNull();
	});

	it("calcula temporada y capítulo iniciales", () => {
		expect(getSeasonProgress(himymSeasons, 0)).toEqual({
			seasonNumber: 1,
			episode: 0,
			completed: false,
		});
	});

	it("calcula temporada y capítulo intermedios", () => {
		expect(getSeasonProgress(himymSeasons, 40)).toEqual({
			seasonNumber: 2,
			episode: 18,
			completed: false,
		});
	});

	it("calcula fin de temporada", () => {
		expect(getSeasonProgress(himymSeasons, 44)).toEqual({
			seasonNumber: 2,
			episode: 22,
			completed: false,
		});
	});

	it("limita al máximo si se pasa", () => {
		expect(getSeasonProgress(himymSeasons, 500)).toEqual({
			seasonNumber: 9,
			episode: 24,
			completed: true,
		});
	});
});

describe("setSeasonProgress", () => {
	it("convierte temporada/capítulo a total", () => {
		expect(setSeasonProgress(himymSeasons, 2, 8)).toBe(30);
	});

	it("limita capítulo al máximo de la temporada", () => {
		expect(setSeasonProgress(himymSeasons, 1, 50)).toBe(22);
	});

	it("devuelve total máximo si la temporada no existe", () => {
		expect(setSeasonProgress(himymSeasons, 99, 1)).toBe(208);
	});
});

describe("formatSeasonProgress", () => {
	it("formatea progreso actual", () => {
		expect(formatSeasonProgress(himymSeasons, 40)).toBe(
			"Temporada 2 · Capítulo 18",
		);
	});

	it("devuelve null sin temporadas", () => {
		expect(formatSeasonProgress([], 0)).toBeNull();
	});
});

describe("getInitialSeasonsFromMetadata", () => {
	it("distribuye episodios equitativamente", () => {
		expect(getInitialSeasonsFromMetadata(208, 9)).toEqual([
			{ seasonNumber: 1, episodeCount: 24 },
			{ seasonNumber: 2, episodeCount: 23 },
			{ seasonNumber: 3, episodeCount: 23 },
			{ seasonNumber: 4, episodeCount: 23 },
			{ seasonNumber: 5, episodeCount: 23 },
			{ seasonNumber: 6, episodeCount: 23 },
			{ seasonNumber: 7, episodeCount: 23 },
			{ seasonNumber: 8, episodeCount: 23 },
			{ seasonNumber: 9, episodeCount: 23 },
		]);
	});

	it("devuelve undefined sin datos suficientes", () => {
		expect(getInitialSeasonsFromMetadata(undefined, 9)).toBeUndefined();
		expect(getInitialSeasonsFromMetadata(208, undefined)).toBeUndefined();
	});
});
