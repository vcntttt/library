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
});
