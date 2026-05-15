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
	it("uses open library as the default provider for books", async () => {
		const { providerByType } = await import("./providers");

		expect(providerByType.book).toBe("open-library");
	});

	it("falls back to open library when google books quota is exceeded", async () => {
		const fetchMock = vi
			.fn()
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
			);

		vi.stubGlobal("fetch", fetchMock);
		const { searchMetadata } = await import("./providers");

		const outcome = await searchMetadata("google-books", "centrate", "book");

		expect(outcome.provider).toBe("open-library");
		expect(outcome.results).toHaveLength(1);
		expect(outcome.results[0]).toMatchObject({
			source: "open-library",
			id: "/books/OL123M",
			title: "Centrate",
			creator: "A. Autor",
			year: 2004,
			pages: 250,
		});
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it("maps open library search results to edition ids when available", async () => {
		const fetchMock = vi.fn().mockResolvedValueOnce(
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
					},
				],
			}),
		);

		vi.stubGlobal("fetch", fetchMock);
		const { searchMetadata } = await import("./providers");

		const outcome = await searchMetadata("open-library", "dune", "book");

		expect(outcome.provider).toBe("open-library");
		expect(outcome.results[0]).toMatchObject({
			source: "open-library",
			id: "/books/OL32848840M",
			title: "Dune",
			creator: "Frank Herbert",
			year: 1965,
			coverUrl: "https://covers.openlibrary.org/b/id/11481354-L.jpg",
			pages: 688,
		});
		expect(fetchMock).toHaveBeenCalledTimes(1);
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
		expect(fetchMock).toHaveBeenCalledTimes(1);
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
});
