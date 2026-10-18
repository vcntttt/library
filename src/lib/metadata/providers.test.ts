import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
	vi.resetModules();
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
});

function jsonResponse(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: {
			"content-type": "application/json",
		},
	});
}

function htmlResponse(body: string, status = 200) {
	return new Response(body, {
		status,
		headers: {
			"content-type": "text/html",
		},
	});
}

const amazonBookHtml = `
	<html>
		<head>
			<link rel="canonical" href="https://www.amazon.com/-/es/Miyamoto-Musashi-ebook/dp/B0DGMDXCCM" />
			<meta property="og:image" content="https://m.media-amazon.com/images/I/fallback.jpg" />
			<meta name="title" content="Amazon.com: Dokk&#333;d&#333; eBook : Musashi, Miyamoto, Galindo, Dani: Tienda Kindle" />
		</head>
		<body>
			<div id="title_feature_div">
				<span id="productTitle">Dokk&#333;d&#333;</span>
			</div>
			<div id="bylineInfo">
				<span class="author notFaded"><a href="/Miyamoto-Musashi/e/B001">Miyamoto Musashi</a></span>
				<span class="author notFaded"><a href="/Dani-Galindo/e/B002">Dani Galindo</a></span>
			</div>
			<img id="landingImage" src="https://m.media-amazon.com/images/I/41mWeisPdDL.jpg" data-old-hires="https://m.media-amazon.com/images/I/71LjzFcWlFL._SL1500_.jpg" />
			<div id="bookDescription_feature_div">
				<div class="a-expander-content">
					<p>Los 21 preceptos de Miyamoto Musashi para vivir con disciplina.</p>
				</div>
				<div class="a-expander-header"></div>
			</div>
			<li data-rpi-attribute-name="book_details-ebook_pages">
				<div class="rpi-attribute-value"><span>132 p&aacute;ginas</span></div>
			</li>
			<li data-rpi-attribute-name="language">
				<div class="rpi-attribute-value"><span>Espa&ntilde;ol</span></div>
			</li>
			<li data-rpi-attribute-name="book_details-publication_date">
				<div class="rpi-attribute-value"><span>19 Septiembre 2024</span></div>
			</li>
		</body>
	</html>
`;

const amazonBlockedHtml = `
	<html>
		<head><title>Robot Check</title></head>
		<body>Enter the characters you see below</body>
	</html>
`;

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
							title: "Céntrate",
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

		const outcome = await searchMetadata("google-books", "céntrate", "book");

		expect(outcome.provider).toBe("google-books");
		expect(outcome.results).toHaveLength(1);
		expect(outcome.results[0]).toMatchObject({
			source: "open-library",
			id: "/books/OL123M",
			title: "Céntrate",
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
			"hay filosofía en tu nevera",
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
			"hay filosofía en tu nevera",
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

	it("searches Google Books by pasted URL", async () => {
		const fetchMock = vi.fn().mockResolvedValueOnce(
			jsonResponse({
				id: "google-dokkodo",
				volumeInfo: {
					title: "Dokkodo",
					authors: ["Miyamoto Musashi"],
					publishedDate: "2008",
					pageCount: 96,
					publisher: "Editorial",
					language: "es",
					industryIdentifiers: [
						{ type: "ISBN_13", identifier: "9781234567897" },
					],
					imageLinks: { thumbnail: "https://example.com/dokkodo.jpg" },
				},
			}),
		);

		vi.stubGlobal("fetch", fetchMock);
		const { searchMetadata } = await import("./providers");

		const outcome = await searchMetadata(
			"google-books",
			"https://books.google.com/books?id=google-dokkodo&hl=es",
			"book",
		);

		expect(outcome.provider).toBe("google-books");
		expect(outcome.results).toHaveLength(1);
		expect(outcome.results[0]).toMatchObject({
			source: "google-books",
			id: "google-dokkodo",
			title: "Dokkodo",
			creator: "Miyamoto Musashi",
			pages: 96,
			publisher: "Editorial",
			isbn13: "9781234567897",
		});
		expect(fetchMock).toHaveBeenCalledWith(
			expect.stringContaining(
				"https://www.googleapis.com/books/v1/volumes/google-dokkodo",
			),
			expect.objectContaining({ signal: expect.any(AbortSignal) }),
		);
	});

	it("searches Open Library by pasted URL", async () => {
		const fetchMock = vi.fn().mockResolvedValueOnce(
			jsonResponse({
				title: "Dokkodo",
				publish_date: "2008",
				number_of_pages: 96,
				covers: [12345],
			}),
		);

		vi.stubGlobal("fetch", fetchMock);
		const { searchMetadata } = await import("./providers");

		const outcome = await searchMetadata(
			"google-books",
			"https://openlibrary.org/books/OL123M/Dokkodo",
			"book",
		);

		expect(outcome.provider).toBe("open-library");
		expect(outcome.results[0]).toMatchObject({
			source: "open-library",
			id: "/books/OL123M",
			title: "Dokkodo",
			year: 2008,
			pages: 96,
			coverUrl: "https://covers.openlibrary.org/b/id/12345-L.jpg",
		});
		expect(fetchMock).toHaveBeenCalledWith(
			"https://openlibrary.org/books/OL123M.json",
			expect.objectContaining({ signal: expect.any(AbortSignal) }),
		);
	});

	it("searches Apple Books by pasted URL", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				jsonResponse({
					results: [
						{
							trackId: 6451271038,
							trackName: "Hay filosofía en tu nevera",
							artistName: "Enric F. Gel",
							releaseDate: "2023-09-14T07:00:00Z",
							trackViewUrl:
								"https://books.apple.com/es/book/hay-filosofia/id6451271038?uo=4",
							artworkUrl100:
								"https://is1-ssl.mzstatic.com/image/thumb/example.jpg/100x100bb.jpg",
						},
					],
				}),
			)
			.mockResolvedValueOnce(jsonResponse({ items: [] }));

		vi.stubGlobal("fetch", fetchMock);
		const { searchMetadata } = await import("./providers");

		const outcome = await searchMetadata(
			"google-books",
			"https://books.apple.com/es/book/hay-filosofia/id6451271038",
			"book",
		);

		expect(outcome.provider).toBe("apple-books");
		expect(outcome.results[0]).toMatchObject({
			source: "apple-books",
			id: "6451271038",
			title: "Hay filosofía en tu nevera",
			creator: "Enric F. Gel",
			year: 2023,
		});
		expect(fetchMock).toHaveBeenCalledWith(
			expect.stringContaining("https://itunes.apple.com/lookup?"),
			expect.objectContaining({ signal: expect.any(AbortSignal) }),
		);
	});

	it("searches TMDB movie and tv URLs for the matching obra type", async () => {
		vi.stubEnv("TMDB_API_KEY", "test-key");
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				jsonResponse({
					id: 603,
					title: "The Matrix",
					release_date: "1999-03-31",
					runtime: 136,
					poster_path: "/matrix.jpg",
				}),
			)
			.mockResolvedValueOnce(jsonResponse({ results: { CL: {} } }))
			.mockResolvedValueOnce(
				jsonResponse({
					id: 1399,
					name: "Game of Thrones",
					first_air_date: "2011-04-17",
					number_of_seasons: 8,
					number_of_episodes: 73,
					status: "Returning Series",
					last_episode_to_air: {
						season_number: 2,
						episode_number: 3,
						air_date: "2012-04-15",
					},
					next_episode_to_air: {
						season_number: 2,
						episode_number: 4,
						air_date: "2012-04-22",
					},
					poster_path: "/got.jpg",
					seasons: [
						{ season_number: 0, episode_count: 1, name: "Specials" },
						{ season_number: 1, episode_count: 10 },
						{ season_number: 2, episode_count: 10 },
					],
				}),
			);

		vi.stubGlobal("fetch", fetchMock);
		const { searchMetadata } = await import("./providers");

		const movieOutcome = await searchMetadata(
			"tmdb",
			"https://www.themoviedb.org/movie/603-the-matrix",
			"movie",
		);
		const seriesOutcome = await searchMetadata(
			"tmdb",
			"https://www.themoviedb.org/tv/1399-game-of-thrones",
			"series",
		);

		expect(movieOutcome.results[0]).toMatchObject({
			source: "tmdb",
			id: "603",
			title: "The Matrix",
			runtime: 136,
		});
		expect(seriesOutcome.results[0]).toMatchObject({
			source: "tmdb",
			id: "1399",
			title: "Game of Thrones",
			seasons: 8,
			episodes: 73,
			episodesAired: 13,
			latestSeasonNumber: 2,
			latestEpisodeNumber: 3,
			seasonDetails: [
				{ seasonNumber: 1, episodeCount: 10 },
				{ seasonNumber: 2, episodeCount: 10 },
			],
		});
	});

	it("searches AniList manga URLs for manga and manhwa", async () => {
		const fetchMock = vi.fn().mockResolvedValueOnce(
			jsonResponse({
				data: {
					Media: {
						id: 169355,
						title: {
							romaji: "Kagurabachi",
							english: null,
							native: "カグラバチ",
						},
						coverImage: {
							extraLarge: "https://example.com/kagurabachi.png",
						},
						startDate: { year: 2023 },
						studios: { nodes: [] },
						staff: { edges: [] },
						status: "RELEASING",
						chapters: 60,
						externalLinks: [],
					},
				},
			}),
		);

		vi.stubGlobal("fetch", fetchMock);
		const { searchMetadata } = await import("./providers");

		const outcome = await searchMetadata(
			"anilist",
			"https://anilist.co/manga/169355/Kagurabachi/",
			"manhwa",
		);

		expect(outcome.provider).toBe("anilist");
		expect(outcome.results[0]).toMatchObject({
			source: "anilist",
			id: "169355",
			title: "Kagurabachi",
			status: "RELEASING",
			latestChapter: 60,
		});
	});

	it("scrapes Amazon book metadata from a pasted product URL", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(htmlResponse(amazonBookHtml));

		vi.stubGlobal("fetch", fetchMock);
		const { searchMetadata } = await import("./providers");

		const outcome = await searchMetadata(
			"google-books",
			"https://www.amazon.com/-/es/dp/B0DGMDXCCM/?coliid=I1XX1466N4AN5H&colid=1BSTY6XI81LPN",
			"book",
		);

		expect(outcome.provider).toBe("amazon");
		expect(outcome.results).toHaveLength(1);
		expect(outcome.results[0]).toMatchObject({
			source: "amazon",
			id: "B0DGMDXCCM",
			title: "Dokkōdō",
			creator: "Miyamoto Musashi, Dani Galindo",
			year: 2024,
			coverUrl: "https://m.media-amazon.com/images/I/71LjzFcWlFL._SL1500_.jpg",
			pages: 132,
			publishedDate: "19 Septiembre 2024",
			language: "Español",
			description:
				"Los 21 preceptos de Miyamoto Musashi para vivir con disciplina.",
			canonicalUrl:
				"https://www.amazon.com/-/es/Miyamoto-Musashi-ebook/dp/B0DGMDXCCM",
		});
		expect(outcome.directUrlFallback).toMatchObject({
			url: "https://www.amazon.com/-/es/Miyamoto-Musashi-ebook/dp/B0DGMDXCCM",
			label: "Amazon",
			identifier: "B0DGMDXCCM",
		});
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("loads Amazon book details by ASIN", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(htmlResponse(amazonBookHtml));

		vi.stubGlobal("fetch", fetchMock);
		const { getMetadataDetails } = await import("./providers");

		const details = await getMetadataDetails("amazon", "B0DGMDXCCM", "book");

		expect(details).toMatchObject({
			source: "amazon",
			id: "B0DGMDXCCM",
			title: "Dokkōdō",
			creator: "Miyamoto Musashi, Dani Galindo",
			pages: 132,
			language: "Español",
		});
		expect(fetchMock).toHaveBeenCalledWith(
			"https://www.amazon.com/dp/B0DGMDXCCM",
			expect.objectContaining({
				headers: expect.objectContaining({
					"Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
				}),
			}),
		);
	});

	it("falls back to creating with the Amazon URL when the ASIN has no catalog match", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(htmlResponse(amazonBlockedHtml))
			.mockResolvedValueOnce(jsonResponse({ docs: [] }))
			.mockResolvedValueOnce(jsonResponse({ items: [] }))
			.mockResolvedValueOnce(jsonResponse({ results: [] }));

		vi.stubGlobal("fetch", fetchMock);
		const { searchMetadata } = await import("./providers");

		const outcome = await searchMetadata(
			"google-books",
			"https://www.amazon.com/-/es/dp/B0DGMDXCCM/?coliid=I1XX1466N4AN5H&colid=1BSTY6XI81LPN",
			"book",
		);

		expect(outcome.provider).toBe("google-books");
		expect(outcome.results).toEqual([]);
		expect(outcome.directUrlFallback).toEqual({
			url: "https://www.amazon.com/dp/B0DGMDXCCM",
			label: "Amazon",
			identifier: "B0DGMDXCCM",
			reason: "No encontré metadatos confiables para este enlace de Amazon.",
		});
		expect(fetchMock).toHaveBeenCalledTimes(4);
	});

	it("keeps the create-with-link fallback for Amazon URLs even when catalog results exist", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(htmlResponse(amazonBlockedHtml))
			.mockResolvedValueOnce(jsonResponse({ docs: [] }))
			.mockResolvedValueOnce(
				jsonResponse({
					items: [
						{
							id: "google-related",
							volumeInfo: {
								title: "Related Book",
								authors: ["Someone"],
								publishedDate: "2024",
							},
						},
					],
				}),
			)
			.mockResolvedValueOnce(jsonResponse({ results: [] }));

		vi.stubGlobal("fetch", fetchMock);
		const { searchMetadata } = await import("./providers");

		const outcome = await searchMetadata(
			"google-books",
			"https://www.amazon.com/dp/B0DGMDXCCM",
			"book",
		);

		expect(outcome.results).toHaveLength(1);
		expect(outcome.directUrlFallback).toMatchObject({
			url: "https://www.amazon.com/dp/B0DGMDXCCM",
			label: "Amazon",
			identifier: "B0DGMDXCCM",
		});
		expect(fetchMock).toHaveBeenCalledTimes(4);
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
			searchMetadata("google-books", "céntrate", "book"),
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
				_sinopsis: "Un niño aprende magia.",
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
			description: "Un niño aprende magia.",
			canonicalUrl:
				"https://www.manhwaweb.com/manhwa/magoinfinito_1717625777860",
			status: "RELEASING",
			latestChapter: 173,
			latestChapterSource: "scraping",
		});
		expect(details.latestChapterCheckedAt).toEqual(expect.any(Number));
		expect(fetchMock).toHaveBeenCalledWith(
			"https://api.manhwaweb.com/manhwa/see/magoinfinito_1717625777860",
			expect.objectContaining({ signal: expect.any(AbortSignal) }),
		);
	});

	it.each([
		["magoinfinito_1717625777860", 190],
		["la-vida-despues-de-la-muerte_1696084388227", 268],
	])(
		"checks current chapters through the active ManhwaWeb API: %s",
		async (id, chapter) => {
			const fetchMock = vi.fn(async (input: string | URL | Request) => {
				if (String(input) !== `https://api.manhwaweb.com/manhwa/see/${id}`) {
					return jsonResponse({ message: "Application not found" }, 404);
				}
				return jsonResponse({
					_id: id,
					real_id: id,
					_tipo: "manhwa",
					_status: "publicandose",
					numero_cap_esp: chapter,
					_numero_cap: chapter,
				});
			});
			vi.stubGlobal("fetch", fetchMock);
			const { getMangaReadingUrlDetails } = await import("./providers");

			const details = await getMangaReadingUrlDetails(
				`https://www.manhwaweb.com/manhwa/${id}`,
				"manhwa",
			);

			expect(details?.latestChapter).toBe(chapter);
		},
	);

	it("searches titles through the active ManhwaWeb API", async () => {
		const fetchMock = vi.fn(async (input: string | URL | Request) => {
			if (
				String(input) !==
				"https://api.manhwaweb.com/manhwa/library?buscar=Mago+Infinito"
			) {
				return jsonResponse({ message: "Application not found" }, 404);
			}
			return jsonResponse({
				data: [
					{
						_id: "magoinfinito_1717625777860",
						_tipo: "manhwa",
						the_real_name: "Mago Infinito",
					},
				],
			});
		});
		vi.stubGlobal("fetch", fetchMock);
		const { searchMetadata } = await import("./providers");

		const result = await searchMetadata("manhwaweb", "Mago Infinito", "manhwa");

		expect(result.results).toEqual([
			expect.objectContaining({
				id: "magoinfinito_1717625777860",
				title: "Mago Infinito",
			}),
		]);
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
				the_real_name: "La Vida Después de la Muerte",
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
			title: "La Vida Después de la Muerte",
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
			expect.objectContaining({ signal: expect.any(AbortSignal) }),
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
			expect.objectContaining({ signal: expect.any(AbortSignal) }),
		);
	});

	it("loads the movie director from TMDB credits", async () => {
		const fetchMock = vi.fn().mockResolvedValueOnce(
			jsonResponse({
				title: "Dune",
				release_date: "2021-10-22",
				credits: {
					crew: [
						{ job: "Writer", name: "Jon Spaihts" },
						{ job: "Director", name: "Denis Villeneuve" },
					],
				},
			}),
		);

		vi.stubGlobal("fetch", fetchMock);
		vi.stubEnv("TMDB_API_KEY", "test-key");
		const { getMetadataDetails } = await import("./providers");

		const details = await getMetadataDetails("tmdb", "438631", "movie");

		expect(details.creator).toBe("Denis Villeneuve");
		expect(fetchMock.mock.calls[0]?.[0]).toContain(
			"append_to_response=credits",
		);
	});

	it("does not fetch Amazon URLs from look-alike hosts", async () => {
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);
		const { searchMetadata } = await import("./providers");

		const outcome = await searchMetadata(
			"amazon",
			"https://evilamazon.com/dp/B012345678",
			"book",
		);

		expect(outcome.results).toEqual([]);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("aborts metadata requests after a timeout with a Spanish message", async () => {
		const fetchMock = vi
			.fn()
			.mockRejectedValueOnce(
				new DOMException("The operation timed out.", "TimeoutError"),
			);
		vi.stubGlobal("fetch", fetchMock);
		const { getMetadataDetails } = await import("./providers");

		await expect(getMetadataDetails("google-books", "abc")).rejects.toThrow(
			"tardó demasiado",
		);
		expect(fetchMock.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
	});

	it("encodes provider ids placed in URL paths", async () => {
		const fetchMock = vi.fn().mockResolvedValueOnce(
			jsonResponse({
				id: "a/b",
				volumeInfo: { title: "Libro" },
			}),
		);
		vi.stubGlobal("fetch", fetchMock);
		const { getMetadataDetails } = await import("./providers");

		await getMetadataDetails("google-books", "a/b");

		expect(new URL(String(fetchMock.mock.calls[0]?.[0])).pathname).toBe(
			"/books/v1/volumes/a%2Fb",
		);
	});

	it("reports AniList GraphQL errors without crashing", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				jsonResponse({ data: null, errors: [{ message: "Rate limit" }] }),
			)
			.mockResolvedValueOnce(jsonResponse({ data: { Media: null } }));
		vi.stubGlobal("fetch", fetchMock);
		const { getMetadataDetails, searchMetadata } = await import("./providers");

		await expect(searchMetadata("anilist", "naruto", "anime")).rejects.toThrow(
			"No se pudo consultar AniList.",
		);
		await expect(getMetadataDetails("anilist", "1")).rejects.toThrow(
			"No se encontraron metadatos en AniList.",
		);
	});

	it("decodes HTML entities without crashing on invalid code points", async () => {
		const fetchMock = vi.fn().mockResolvedValueOnce(
			jsonResponse({
				id: "abc",
				volumeInfo: {
					title: "Libro",
					description: "Caf&eacute; &#99999999; &amp;lt;",
				},
			}),
		);
		vi.stubGlobal("fetch", fetchMock);
		const { getMetadataDetails } = await import("./providers");

		const details = await getMetadataDetails("google-books", "abc");

		expect(details.description).toBe("Café � &lt;");
	});

	it("reads double-quoted Amazon meta values that contain apostrophes", async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				htmlResponse(
					`<html><head><meta name="title" content="Ender's Game"></head><body></body></html>`,
				),
			);
		vi.stubGlobal("fetch", fetchMock);
		const { getMetadataDetails } = await import("./providers");

		const details = await getMetadataDetails("amazon", "B012345678");

		expect(details.title).toBe("Ender's Game");
	});

	it("does not treat look-alike ManhwaWeb hosts as direct ids", async () => {
		const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ data: [] }));
		vi.stubGlobal("fetch", fetchMock);
		const { searchMetadata } = await import("./providers");

		await searchMetadata("manhwaweb", "https://evilmanhwaweb.com/manhwa/x_1");

		expect(new URL(String(fetchMock.mock.calls[0]?.[0])).pathname).toBe(
			"/manhwa/library",
		);
	});
	describe("image proxy route", () => {
		async function callImageProxy(url: string) {
			const { Route } = await import("@/routes/api/metadata/image");
			const route = Route as unknown as {
				options: {
					server: {
						handlers: {
							GET: (context: { request: Request }) => Promise<Response>;
						};
					};
				};
			};
			return route.options.server.handlers.GET({
				request: new Request(
					`http://localhost/api/metadata/image?url=${encodeURIComponent(url)}`,
				),
			});
		}

		const imageUrl = "https://img1mw.xyz/cover.png";

		it("serves raster images from allowed hosts with nosniff", async () => {
			const fetchMock = vi.fn().mockResolvedValueOnce(
				new Response("png-bytes", {
					status: 200,
					headers: { "content-type": "image/png" },
				}),
			);
			vi.stubGlobal("fetch", fetchMock);

			const response = await callImageProxy(imageUrl);

			expect(response.status).toBe(200);
			expect(response.headers.get("x-content-type-options")).toBe("nosniff");
			expect(await response.text()).toBe("png-bytes");
		});

		it("accepts image/jpg and image/pjpeg from CDNs", async () => {
			for (const contentType of ["image/jpg", "image/pjpeg"]) {
				const fetchMock = vi.fn().mockResolvedValueOnce(
					new Response("jpg-bytes", {
						status: 200,
						headers: { "content-type": contentType },
					}),
				);
				vi.stubGlobal("fetch", fetchMock);

				const response = await callImageProxy(imageUrl);

				expect(response.status).toBe(200);
				expect(response.headers.get("content-type")).toBe(contentType);
			}
		});

		it("refuses SVG responses", async () => {
			const fetchMock = vi.fn().mockResolvedValueOnce(
				new Response("<svg></svg>", {
					status: 200,
					headers: { "content-type": "image/svg+xml" },
				}),
			);
			vi.stubGlobal("fetch", fetchMock);

			const response = await callImageProxy(imageUrl);

			expect(response.status).toBe(502);
		});

		it("does not follow redirects to hosts outside the allowlist", async () => {
			const fetchMock = vi.fn().mockResolvedValueOnce(
				new Response(null, {
					status: 302,
					headers: { location: "http://169.254.169.254/latest/meta-data" },
				}),
			);
			vi.stubGlobal("fetch", fetchMock);

			const response = await callImageProxy(imageUrl);

			expect(response.status).toBe(502);
			expect(fetchMock).toHaveBeenCalledTimes(1);
		});

		it("rejects images whose declared size exceeds the limit", async () => {
			const fetchMock = vi.fn().mockResolvedValueOnce(
				new Response("x", {
					status: 200,
					headers: {
						"content-type": "image/jpeg",
						"content-length": String(50 * 1024 * 1024),
					},
				}),
			);
			vi.stubGlobal("fetch", fetchMock);

			const response = await callImageProxy(imageUrl);

			expect(response.status).toBe(502);
		});
	});
});
