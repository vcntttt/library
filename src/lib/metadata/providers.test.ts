import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
	vi.resetModules();
});

afterEach(() => {
	vi.unstubAllGlobals();
});

function jsonResponse(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: {
			"content-type": "application/json",
		},
	});
}

describe("metadata providers", () => {
	it("uses google books as the default provider for books", async () => {
		const { providerByType } = await import("./providers");

		expect(providerByType.book).toBe("google-books");
	});

	it("falls back to open library when google books quota is exceeded", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				jsonResponse({
					docs: [
						{
							key: "/books/OL123M",
							title: "Centrate",
							author_name: ["A. Autor"],
							first_publish_year: 2004,
							number_of_pages_median: 250,
							cover_i: 123,
						},
					],
				}),
			)
			.mockResolvedValueOnce(
				jsonResponse(
					{
						error: {
							message:
								"Quota exceeded for quota metric 'Queries' and limit 'Queries per day' of service 'books.googleapis.com' for consumer 'project_number:123'.",
							errors: [{ reason: "quotaExceeded" }],
						},
					},
					403,
				),
			)
			.mockResolvedValueOnce(jsonResponse({ results: [] }));

		vi.stubGlobal("fetch", fetchMock);
		const { searchMetadata } = await import("./providers");

		const outcome = await searchMetadata("google-books", "centrate", "book");

		expect(outcome.provider).toBe("google-books");
		expect(outcome.results).toHaveLength(1);
		expect(outcome.results[0]).toMatchObject({
			source: "open-library",
			id: "/books/OL123M",
			title: "Centrate",
			creator: "A. Autor",
			year: 2004,
			pages: 250,
		});
		expect(fetchMock).toHaveBeenCalledTimes(3);
	});

	it("combines book search results with google books first", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				jsonResponse({
					docs: [
						{
							key: "/works/OL27448W",
							title: "Dune",
							author_name: ["Frank Herbert"],
							first_publish_year: 1965,
							number_of_pages_median: 688,
							cover_i: 11481354,
							cover_edition_key: "OL32848840M",
							edition_key: ["OL26437782M"],
							isbn: ["0441172717", "9780441172719"],
							publisher: ["Ace"],
							language: ["eng"],
						},
					],
				}),
			)
			.mockResolvedValueOnce(
				jsonResponse({
					items: [
						{
							id: "google-dune",
							volumeInfo: {
								title: "Dune",
								authors: ["Frank Herbert"],
								publishedDate: "1965",
								pageCount: 688,
								publisher: "Ace",
								language: "en",
								industryIdentifiers: [
									{ type: "ISBN_10", identifier: "0441172717" },
									{ type: "ISBN_13", identifier: "9780441172719" },
								],
								imageLinks: { thumbnail: "https://example.com/dune.jpg" },
							},
						},
					],
				}),
			)
			.mockResolvedValueOnce(
				jsonResponse({
					results: [
						{
							trackId: 6451271038,
							trackName: "¿Hay filosofía en tu nevera?",
							artistName: "Enric F. Gel",
							releaseDate: "2023-09-14T07:00:00Z",
							genres: ["Juvenil", "Libros"],
							language: "ES",
							description: "<b>La filosofía como nunca te la han contado.</b>",
							trackViewUrl: "https://books.apple.com/es/book/example",
							artworkUrl100:
								"https://is1-ssl.mzstatic.com/image/thumb/example.jpg/100x100bb.jpg",
						},
					],
				}),
			);

		vi.stubGlobal("fetch", fetchMock);
		const { searchMetadata } = await import("./providers");

		const outcome = await searchMetadata("google-books", "dune", "book");

		expect(outcome.provider).toBe("google-books");
		expect(outcome.results[0]).toMatchObject({
			source: "google-books",
			title: "Dune",
			creator: "Frank Herbert",
			year: 1965,
			pages: 688,
			isbn13: "9780441172719",
		});
		expect(outcome.results).toHaveLength(2);
		expect(fetchMock).toHaveBeenCalledTimes(3);
	});

	it("merges duplicate book search results without replacing the canonical provider", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(jsonResponse({ docs: [] }))
			.mockResolvedValueOnce(
				jsonResponse({
					items: [
						{
							id: "google-nevera",
							volumeInfo: {
								title: "¿Hay filosofía en tu nevera?",
								authors: ["Enric F. Gel"],
								publishedDate: "2023",
								pageCount: 224,
								imageLinks: {
									thumbnail:
										"http://books.google.com/books/content?id=google-nevera&printsec=frontcover&img=1&zoom=2&source=gbs_api",
								},
								industryIdentifiers: [
									{ type: "ISBN_13", identifier: "9788419357182" },
								],
							},
						},
					],
				}),
			)
			.mockResolvedValueOnce(
				jsonResponse({
					results: [
						{
							trackId: 6451271038,
							trackName: "¿Hay filosofía en tu nevera?",
							artistName: "Enric F. Gel",
							releaseDate: "2023-09-14T07:00:00Z",
							description: "<b>La filosofía como nunca te la han contado.</b>",
							trackViewUrl:
								"https://books.apple.com/es/book/hay-filosofia/id6451271038?uo=4",
							artworkUrl100:
								"https://is1-ssl.mzstatic.com/image/thumb/Publication211/v4/cf/0b/f5/cf0bf555-1889-3bde-b7b3-8133f0f37247/9788419357182.jpg/100x100bb.jpg",
						},
					],
				}),
			);

		vi.stubGlobal("fetch", fetchMock);
		const { searchMetadata } = await import("./providers");

		const outcome = await searchMetadata(
			"google-books",
			"hay filosofia en tu nevera",
			"book",
		);

		expect(outcome.results).toHaveLength(1);
		expect(outcome.results[0]).toMatchObject({
			source: "google-books",
			id: "google-nevera",
			title: "¿Hay filosofía en tu nevera?",
			creator: "Enric F. Gel",
			pages: 224,
			isbn13: "9788419357182",
			coverUrl:
				"https://is1-ssl.mzstatic.com/image/thumb/Publication211/v4/cf/0b/f5/cf0bf555-1889-3bde-b7b3-8133f0f37247/9788419357182.jpg/600x900bb.jpg",
			description: "La filosofía como nunca te la han contado.",
		});
		expect(fetchMock).toHaveBeenCalledTimes(3);
	});

	it("finds commercial Spanish ebooks through apple books when open library is empty and google is quota limited", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(jsonResponse({ docs: [] }))
			.mockResolvedValueOnce(
				jsonResponse(
					{
						error: {
							message:
								"Quota exceeded for quota metric 'Queries' and limit 'Queries per day'.",
							errors: [{ reason: "rateLimitExceeded" }],
						},
					},
					429,
				),
			)
			.mockResolvedValueOnce(
				jsonResponse({
					results: [
						{
							trackId: 6451271038,
							trackName: "¿Hay filosofía en tu nevera?",
							artistName: "Enric F. Gel",
							releaseDate: "2023-09-14T07:00:00Z",
							genres: ["Juvenil", "Libros"],
							language: "ES",
							description: "<b>La filosofía como nunca te la han contado.</b>",
							trackViewUrl: "https://books.apple.com/es/book/example",
							artworkUrl100:
								"https://is1-ssl.mzstatic.com/image/thumb/example.jpg/100x100bb.jpg",
						},
					],
				}),
			);

		vi.stubGlobal("fetch", fetchMock);
		const { searchMetadata } = await import("./providers");

		const outcome = await searchMetadata(
			"google-books",
			"hay filosofia en tu nevera",
			"book",
		);

		expect(outcome.results[0]).toMatchObject({
			source: "apple-books",
			id: "6451271038",
			title: "¿Hay filosofía en tu nevera?",
			creator: "Enric F. Gel",
			year: 2023,
			language: "ES",
		});
		expect(fetchMock).toHaveBeenCalledTimes(3);
	});

	it("enriches apple books details with google books page count when available", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				jsonResponse({
					results: [
						{
							trackId: 6451271038,
							trackName: "¿Hay filosofía en tu nevera?",
							artistName: "Enric F. Gel",
							releaseDate: "2023-09-14T07:00:00Z",
							trackViewUrl:
								"https://books.apple.com/es/book/hay-filosofia/id6451271038?uo=4",
							artworkUrl100:
								"https://is1-ssl.mzstatic.com/image/thumb/Publication211/v4/cf/0b/f5/cf0bf555-1889-3bde-b7b3-8133f0f37247/9788419357182.jpg/100x100bb.jpg",
						},
					],
				}),
			)
			.mockResolvedValueOnce(
				jsonResponse({
					items: [
						{
							id: "google-nevera",
							volumeInfo: {
								title: "¿Hay filosofía en tu nevera?",
								authors: ["Enric F. Gel"],
								publishedDate: "2023-09-14",
								pageCount: 224,
								industryIdentifiers: [
									{ type: "ISBN_13", identifier: "9788419357182" },
								],
							},
						},
					],
				}),
			);

		vi.stubGlobal("fetch", fetchMock);
		const { getMetadataDetails } = await import("./providers");

		const details = await getMetadataDetails(
			"apple-books",
			"6451271038",
			"book",
		);

		expect(details).toMatchObject({
			source: "apple-books",
			id: "6451271038",
			title: "¿Hay filosofía en tu nevera?",
			pages: 224,
			isbn13: "9788419357182",
		});
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it("loads open library edition details with author names", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				jsonResponse({
					title: "Dune",
					publish_date: "1965",
					number_of_pages: 688,
					covers: [11481354],
					authors: [{ key: "/authors/OL79034A" }],
				}),
			)
			.mockResolvedValueOnce(
				jsonResponse({
					name: "Frank Herbert",
				}),
			);

		vi.stubGlobal("fetch", fetchMock);
		const { getMetadataDetails } = await import("./providers");

		const details = await getMetadataDetails(
			"open-library",
			"/books/OL32848840M",
			"book",
		);

		expect(details).toMatchObject({
			source: "open-library",
			id: "/books/OL32848840M",
			title: "Dune",
			creator: "Frank Herbert",
			year: 1965,
			coverUrl: "https://covers.openlibrary.org/b/id/11481354-L.jpg",
			pages: 688,
		});
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it("loads open library work details and merges best edition pages", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				jsonResponse({
					title: "Dune",
					first_publish_date: "1965",
					covers: [240726],
					authors: [{ author: { key: "/authors/OL79034A" } }],
				}),
			)
			.mockResolvedValueOnce(
				jsonResponse({
					name: "Frank Herbert",
				}),
			)
			.mockResolvedValueOnce(
				jsonResponse({
					entries: [
						{
							title: "Dune",
							publish_date: "June 1990",
							number_of_pages: 535,
							covers: [11481354],
						},
					],
				}),
			);

		vi.stubGlobal("fetch", fetchMock);
		const { getMetadataDetails } = await import("./providers");

		const details = await getMetadataDetails(
			"open-library",
			"/works/OL27448W",
			"book",
		);

		expect(details).toMatchObject({
			source: "open-library",
			id: "/works/OL27448W",
			title: "Dune",
			creator: "Frank Herbert",
			year: 1965,
			coverUrl: "https://covers.openlibrary.org/b/id/240726-L.jpg",
			pages: 535,
		});
		expect(fetchMock).toHaveBeenCalledTimes(3);
	});

	it("keeps non-quota google books errors visible", async () => {
		const fetchMock = vi.fn().mockResolvedValueOnce(
			jsonResponse(
				{
					error: {
						message: "Something went wrong.",
						errors: [{ reason: "backendError" }],
					},
				},
				500,
			),
		);

		vi.stubGlobal("fetch", fetchMock);
		const { searchMetadata } = await import("./providers");

		await expect(
			searchMetadata("google-books", "centrate", "book"),
		).rejects.toThrow("Something went wrong.");
		expect(fetchMock).toHaveBeenCalledTimes(3);
	});

	it("normalizes direct google books detail quota errors into a readable message", async () => {
		const fetchMock = vi.fn().mockResolvedValueOnce(
			jsonResponse(
				{
					error: {
						message:
							"Quota exceeded for quota metric 'Queries' and limit 'Queries per day' of service 'books.googleapis.com' for consumer 'project_number:123'.",
						errors: [{ reason: "quotaExceeded" }],
					},
				},
				403,
			),
		);

		vi.stubGlobal("fetch", fetchMock);
		const { getMetadataDetails } = await import("./providers");

		await expect(
			getMetadataDetails("google-books", "abc123", "book"),
		).rejects.toThrow(
			"Google Books agotó su cuota diaria. Configura GOOGLE_BOOKS_API_KEY o usa Open Library.",
		);
	});

	it("does not treat null AniList manga chapters as a resolved latest chapter", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				jsonResponse({
					data: {
						Media: {
							id: 169355,
							idMal: 165304,
							title: {
								romaji: "Kagurabachi",
								english: null,
								native: "カグラバチ",
							},
							coverImage: {
								extraLarge: "https://example.com/kagurabachi.png",
								large: "https://example.com/kagurabachi-small.png",
							},
							startDate: { year: 2023 },
							studios: { nodes: [] },
							staff: { edges: [] },
							season: null,
							seasonYear: null,
							status: "RELEASING",
							episodes: null,
							chapters: null,
							volumes: null,
							nextAiringEpisode: null,
							externalLinks: [
								{
									site: "MANGA Plus",
									url: "https://mangaplus.shueisha.co.jp/titles/100274",
								},
							],
						},
					},
				}),
			)
			.mockResolvedValueOnce(jsonResponse({ error: { message: "banned" } }))
			.mockResolvedValueOnce(jsonResponse({ data: [] }, 503));

		vi.stubGlobal("fetch", fetchMock);
		const { getMetadataDetails } = await import("./providers");

		const details = await getMetadataDetails("anilist", "169355", "manga");

		expect(details).toMatchObject({
			source: "anilist",
			id: "169355",
			title: "Kagurabachi",
			status: "RELEASING",
			mangaPlusTitleId: "100274",
		});
		expect(details.latestChapter).toBeUndefined();
		expect(details.latestChapterSource).toBeUndefined();
		expect(details.latestChapterCheckedAt).toEqual(expect.any(Number));
	});

	it("resolves ManhwaWeb details with the latest Spanish chapter", async () => {
		const fetchMock = vi.fn().mockResolvedValueOnce(
			jsonResponse({
				_id: "magoinfinito_1717625777860",
				real_id: "magoinfinito_1717625777860",
				_imagen: "https://img2mw.xyz/mago.webp",
				_status: "publicandose",
				_numero_cap: 172,
				numero_cap_esp: 173,
				_tipo: "manhwa",
				the_real_name: "Mago Infinito",
				_sinopsis: "Un nino aprende magia.",
				_extras: { autores: ["Kim Chiwoo"] },
				chapters: [{ chapter: 172 }, { chapter: 173 }],
			}),
		);

		vi.stubGlobal("fetch", fetchMock);
		const { getMetadataDetails } = await import("./providers");

		const details = await getMetadataDetails(
			"manhwaweb",
			"magoinfinito_1717625777860",
			"manhwa",
		);

		expect(details).toMatchObject({
			source: "manhwaweb",
			id: "magoinfinito_1717625777860",
			title: "Mago Infinito",
			creator: "Kim Chiwoo",
			coverUrl: "/api/metadata/image?url=https%3A%2F%2Fimg2mw.xyz%2Fmago.webp",
			description: "Un nino aprende magia.",
			canonicalUrl:
				"https://www.manhwaweb.com/manhwa/magoinfinito_1717625777860",
			status: "RELEASING",
			latestChapter: 173,
			latestChapterSource: "scraping",
		});
		expect(details.latestChapterCheckedAt).toEqual(expect.any(Number));
		expect(fetchMock).toHaveBeenCalledWith(
			"https://manhwawebbackend-production.up.railway.app/manhwa/see/magoinfinito_1717625777860",
			undefined,
		);
	});

	it("searches ManhwaWeb by pasted URL", async () => {
		const fetchMock = vi.fn().mockResolvedValueOnce(
			jsonResponse({
				_id: "la-vida-despues-de-la-muerte_1696084388227",
				real_id: "la-vida-despues-de-la-muerte_1696084388227",
				_imagen: "https://img1mw.xyz/tbate.webp",
				_status: "publicandose",
				_numero_cap: 251,
				numero_cap_esp: 251,
				_tipo: "manhwa",
				the_real_name: "La Vida Despues de la Muerte",
			}),
		);

		vi.stubGlobal("fetch", fetchMock);
		const { searchMetadata } = await import("./providers");

		const outcome = await searchMetadata(
			"manhwaweb",
			"https://www.manhwaweb.com/manhwa/la-vida-despues-de-la-muerte_1696084388227",
			"manhwa",
		);

		expect(outcome.provider).toBe("manhwaweb");
		expect(outcome.results).toHaveLength(1);
		expect(outcome.results[0]).toMatchObject({
			source: "manhwaweb",
			id: "la-vida-despues-de-la-muerte_1696084388227",
			title: "La Vida Despues de la Muerte",
			coverUrl: "/api/metadata/image?url=https%3A%2F%2Fimg1mw.xyz%2Ftbate.webp",
			latestChapter: 251,
			latestChapterSource: "scraping",
			canonicalUrl:
				"https://www.manhwaweb.com/manhwa/la-vida-despues-de-la-muerte_1696084388227",
		});
	});

	it("reads latest chapters from a MangaDex reading URL", async () => {
		const fetchMock = vi.fn().mockResolvedValueOnce(
			jsonResponse({
				data: [
					{ attributes: { chapter: "879" } },
					{ attributes: { chapter: "878.5" } },
				],
			}),
		);

		vi.stubGlobal("fetch", fetchMock);
		const { getMangaReadingUrlDetails } = await import("./providers");

		const details = await getMangaReadingUrlDetails(
			"https://mangadex.org/title/077a3fed-1634-424f-be7a-9a96b7f07b78/kingdom",
			"manga",
		);

		expect(details).toMatchObject({
			source: "anilist",
			id: "077a3fed-1634-424f-be7a-9a96b7f07b78",
			mangaDexId: "077a3fed-1634-424f-be7a-9a96b7f07b78",
			latestChapter: 879,
			latestChapterSource: "scraping",
			canonicalUrl:
				"https://mangadex.org/title/077a3fed-1634-424f-be7a-9a96b7f07b78/kingdom",
		});
		expect(details?.latestChapterCheckedAt).toEqual(expect.any(Number));
		expect(fetchMock).toHaveBeenCalledWith(
			expect.stringContaining("https://api.mangadex.org/chapter?"),
			undefined,
		);
	});

	it("reads latest chapters from a Cubari reading URL", async () => {
		const fetchMock = vi.fn().mockResolvedValueOnce(
			jsonResponse({
				title: "One Piece (ES)",
				author: "Eiichiro Oda",
				cover: "https://example.com/one-piece.jpg",
				chapters: {
					"1184": {},
					"1185": {},
				},
			}),
		);

		vi.stubGlobal("fetch", fetchMock);
		const { getMangaReadingUrlDetails } = await import("./providers");

		const details = await getMangaReadingUrlDetails(
			"https://cubari.moe/read/gist/cmF3L21pZ3VlbEdsejM0NS9Mb3NNdWdpd2FyYVNjYW5zL21haW4vT25lJTIwUGllY2UuanNvbg/",
			"manga",
		);

		expect(details).toMatchObject({
			source: "anilist",
			title: "One Piece (ES)",
			creator: "Eiichiro Oda",
			coverUrl: "https://example.com/one-piece.jpg",
			latestChapter: 1185,
			latestChapterSource: "scraping",
		});
		expect(details?.canonicalUrl).toBe(
			"https://cubari.moe/read/gist/cmF3L21pZ3VlbEdsejM0NS9Mb3NNdWdpd2FyYVNjYW5zL21haW4vT25lJTIwUGllY2UuanNvbg/",
		);
		expect(fetchMock).toHaveBeenCalledWith(
			"https://raw.githubusercontent.com/miguelGlz345/LosMugiwaraScans/main/One%20Piece.json",
			undefined,
		);
	});
});
