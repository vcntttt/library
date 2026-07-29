import { describe, expect, it } from "vitest";
import { buildMetadataPayload } from "./payload";

describe("buildMetadataPayload", () => {
	it("conserva los metadatos persistibles y excluye el detalle de temporadas", () => {
		expect(
			buildMetadataPayload({
				source: "tmdb",
				id: "4194",
				title: "Star Wars: The Clone Wars",
				seasons: 7,
				episodes: 133,
				seasonDetails: [
					{ seasonNumber: 1, episodeCount: 22 },
					{ seasonNumber: 2, episodeCount: 22 },
				],
			}),
		).toEqual({
			seasons: 7,
			episodes: 133,
		});
	});

	it("devuelve undefined cuando no hay información persistible", () => {
		expect(
			buildMetadataPayload({
				source: "tmdb",
				id: "4194",
				title: "Star Wars: The Clone Wars",
			}),
		).toBeUndefined();
	});

	it("inicializa el episodio notificado con el último ya emitido", () => {
		expect(
			buildMetadataPayload({
				source: "tmdb",
				id: "4194",
				title: "Star Wars: The Clone Wars",
				episodesAired: 12,
			}),
		).toEqual({
			episodesAired: 12,
			lastNotifiedEpisode: 12,
		});
	});

	it("no silencia estrenos descubiertos por una actualización manual", () => {
		expect(
			buildMetadataPayload(
				{
					source: "tmdb",
					id: "4194",
					title: "Star Wars: The Clone Wars",
					episodesAired: 13,
					latestChapter: 42,
				},
				{
					initializeNotificationBaseline: false,
					previousMetadata: {
						episodesAired: 12,
						latestChapter: 41,
					},
				},
			),
		).toEqual({
			episodesAired: 13,
			latestChapter: 42,
			lastNotifiedEpisode: 12,
			lastNotifiedChapter: 41,
		});
	});

	it("deja un baseline explícito al refrescar una obra antigua", () => {
		expect(
			buildMetadataPayload(
				{
					source: "tmdb",
					id: "4194",
					episodesAired: 13,
				},
				{ initializeNotificationBaseline: false },
			),
		).toEqual({
			episodesAired: 13,
			lastNotifiedEpisode: 0,
			lastNotifiedChapter: 0,
		});
	});
});
