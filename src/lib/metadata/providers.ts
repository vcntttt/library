import type { ObraType } from "@/lib/types";
import type {
	MetadataDetails,
	MetadataSearchResult,
	MetadataSource,
} from "./types";

const CACHE_TTL_MS = 5 * 60 * 1000;

const providerRateLimits: Record<MetadataSource, number> = {
	"google-books": 250,
	"open-library": 250,
	"apple-books": 250,
	tmdb: 300,
	anilist: 300,
};

const providerCache = new Map<
	string,
	{ expiresAt: number; value: MetadataSearchResult[] }
>();

const detailsCache = new Map<
	string,
	{ expiresAt: number; value: MetadataDetails }
>();

const DETAILS_CACHE_VERSION = "v2";

const providerLastRequest = new Map<MetadataSource, number>();

export interface MetadataSearchOutcome {
	provider: MetadataSource;
	results: MetadataSearchResult[];
}

export const providerByType: Record<ObraType, MetadataSource> = {
	book: "google-books",
	movie: "tmdb",
	series: "tmdb",
	anime: "anilist",
	manga: "anilist",
	manhwa: "anilist",
};

export async function searchMetadata(
	provider: MetadataSource,
	query: string,
	obraType?: ObraType,
): Promise<MetadataSearchOutcome> {
	const trimmedQuery = query.trim();
	if (!trimmedQuery) {
		return { provider, results: [] };
	}

	const cacheKey = `${provider}:${trimmedQuery.toLowerCase()}:${obraType ?? ""}`;
	const cached = providerCache.get(cacheKey);
	if (cached && cached.expiresAt > Date.now()) {
		return { provider, results: cached.value };
	}

	const outcome = await searchMetadataForProvider(
		provider,
		trimmedQuery,
		obraType,
	);

	const outcomeCacheKey = `${outcome.provider}:${trimmedQuery.toLowerCase()}:${obraType ?? ""}`;
	providerCache.set(outcomeCacheKey, {
		expiresAt: Date.now() + CACHE_TTL_MS,
		value: outcome.results,
	});

	return outcome;
}

async function enforceRateLimit(provider: MetadataSource) {
	const minIntervalMs = providerRateLimits[provider];
	const lastRequest = providerLastRequest.get(provider) ?? 0;
	const elapsed = Date.now() - lastRequest;
	if (elapsed < minIntervalMs) {
		await new Promise((resolve) =>
			setTimeout(resolve, minIntervalMs - elapsed),
		);
	}
	providerLastRequest.set(provider, Date.now());
}

async function searchMetadataForProvider(
	provider: MetadataSource,
	query: string,
	obraType?: ObraType,
): Promise<MetadataSearchOutcome> {
	await enforceRateLimit(provider);

	switch (provider) {
		case "google-books":
			return obraType === "book"
				? {
						provider: "google-books",
						results: await searchBookCatalog(query),
					}
				: searchGoogleBooks(query, { fallbackToOpenLibrary: true });
		case "open-library":
			return {
				provider: "open-library",
				results:
					obraType === "book"
						? await searchBookCatalog(query)
						: await searchOpenLibrary(query),
			};
		case "apple-books":
			return {
				provider: "apple-books",
				results: await searchAppleBooks(query),
			};
		case "tmdb":
			return {
				provider: "tmdb",
				results: await searchTmdb(query, obraType),
			};
		case "anilist":
			return {
				provider: "anilist",
				results: await searchAnilist(query, obraType),
			};
	}

	throw new Error("Proveedor de metadatos inválido.");
}

async function searchGoogleBooks(
	query: string,
	options: { fallbackToOpenLibrary?: boolean } = {},
): Promise<MetadataSearchOutcome> {
	const url = new URL("https://www.googleapis.com/books/v1/volumes");
	url.searchParams.set("q", query);
	url.searchParams.set("maxResults", "6");

	const apiKey = process.env.GOOGLE_BOOKS_API_KEY;
	if (apiKey) {
		url.searchParams.set("key", apiKey);
	}

	try {
		const data = await fetchJson<{ items?: GoogleBooksItem[] }>(url.toString());
		return {
			provider: "google-books",
			results: data.items?.map(mapGoogleBookItem) ?? [],
		};
	} catch (error) {
		if (options.fallbackToOpenLibrary && isGoogleBooksQuotaError(error)) {
			return {
				provider: "open-library",
				results: await searchOpenLibrary(query),
			};
		}

		throw error;
	}
}

async function searchBookCatalog(query: string) {
	const [openLibraryResults, googleOutcome, appleBooksResults] =
		await Promise.allSettled([
			searchOpenLibrary(query),
			searchGoogleBooks(query),
			searchAppleBooks(query),
		]);

	const googleResults =
		googleOutcome.status === "fulfilled" ? googleOutcome.value.results : [];
	const openLibrary =
		openLibraryResults.status === "fulfilled" ? openLibraryResults.value : [];
	const appleBooks =
		appleBooksResults.status === "fulfilled"
			? appleBooksResults.value.map((result) => {
					const isbn13 = extractAppleBookIsbn(result);
					return isbn13 ? { ...result, isbn13 } : result;
				})
			: [];

	const results = [...googleResults, ...appleBooks, ...openLibrary];

	if (!results.length) {
		if (openLibraryResults.status === "rejected")
			throw openLibraryResults.reason;
		if (
			googleOutcome.status === "rejected" &&
			!isGoogleBooksQuotaError(googleOutcome.reason)
		) {
			throw googleOutcome.reason;
		}
		if (appleBooksResults.status === "rejected") throw appleBooksResults.reason;
	}

	return dedupeBookResults(results).slice(0, 8);
}

async function searchAppleBooks(query: string) {
	const url = new URL("https://itunes.apple.com/search");
	url.searchParams.set("term", query);
	url.searchParams.set("entity", "ebook");
	url.searchParams.set("country", "ES");
	url.searchParams.set("limit", "6");

	const data = await fetchJson<AppleBooksSearchResponse>(url.toString());
	return data.results?.map(mapAppleBookItem) ?? [];
}

async function enrichAppleBookResult(result: MetadataSearchResult) {
	if (result.source !== "apple-books") return result;
	if (result.pages && result.isbn13) return result;

	const isbn13 = result.isbn13 ?? extractAppleBookIsbn(result);
	const candidates = await searchGoogleBooksForEnrichment({
		isbn13,
		title: result.title,
		creator: result.creator,
	});
	const bestMatch = selectBestGoogleBookMatch(candidates, {
		...result,
		isbn13,
	});
	if (!bestMatch) {
		return isbn13 ? { ...result, isbn13 } : result;
	}

	return mergeBookMetadata(result, {
		...bestMatch,
		isbn13: bestMatch.isbn13 ?? isbn13,
	});
}

async function searchOpenLibrary(query: string) {
	const url = new URL("https://openlibrary.org/search.json");
	url.searchParams.set("q", query);
	url.searchParams.set("limit", "6");

	const data = await fetchJson<OpenLibraryResponse>(url.toString());
	return (
		data.docs?.map((doc) => {
			const id = getOpenLibrarySearchResultId(doc);
			return {
				source: "open-library" as const,
				id,
				title: doc.title,
				creator: doc.author_name?.join(", "),
				year: doc.first_publish_year,
				coverUrl: doc.cover_i ? getOpenLibraryCoverUrl(doc.cover_i) : undefined,
				pages: doc.number_of_pages_median,
				isbn10: pickIsbn(doc.isbn, 10),
				isbn13: pickIsbn(doc.isbn, 13),
				publisher: doc.publisher?.[0],
				publishedDate: doc.first_publish_year
					? String(doc.first_publish_year)
					: undefined,
				language: doc.language?.[0],
			};
		}) ?? []
	);
}

async function searchTmdb(query: string, obraType?: ObraType) {
	const apiKey = process.env.TMDB_API_KEY;
	if (!apiKey) {
		throw new Error("Falta configurar TMDB_API_KEY.");
	}

	const endpoint = obraType === "movie" ? "movie" : "tv";
	const url = new URL(`https://api.themoviedb.org/3/search/${endpoint}`);
	url.searchParams.set("query", query);
	url.searchParams.set("api_key", apiKey);
	url.searchParams.set("language", "es-ES");

	const data = await fetchJson<{ results?: TmdbResult[] }>(url.toString());
	return (
		data.results?.slice(0, 6).map((result) => ({
			source: "tmdb" as const,
			id: String(result.id),
			title: result.title ?? result.name ?? "Sin título",
			creator: undefined,
			year: parseYear(result.release_date ?? result.first_air_date),
			coverUrl: result.poster_path
				? `https://image.tmdb.org/t/p/original${result.poster_path}`
				: undefined,
		})) ?? []
	);
}

async function searchAnilist(query: string, obraType?: ObraType) {
	const mediaType =
		obraType === "manga" || obraType === "manhwa" ? "MANGA" : "ANIME";
	const response = await fetchJson<AnilistResponse>(
		"https://graphql.anilist.co",
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				query: ANILIST_QUERY,
				variables: {
					search: query,
					type: mediaType,
				},
			}),
		},
	);

	return (
		response.data.Page.media?.map((media) => ({
			source: "anilist" as const,
			id: String(media.id),
			title:
				media.title.english ??
				media.title.romaji ??
				media.title.native ??
				"Sin título",
			creator: getAnilistCreator(media, obraType),
			year: media.startDate?.year ?? undefined,
			coverUrl: media.coverImage?.extraLarge ?? media.coverImage?.large,
			episodes: media.episodes ?? undefined,
			volumes: media.volumes ?? undefined,
			status: media.status ?? undefined,
			season: media.season ?? undefined,
			seasonYear: media.seasonYear ?? undefined,
		})) ?? []
	);
}

async function getGoogleBookDetails(id: string): Promise<MetadataDetails> {
	const apiKey = process.env.GOOGLE_BOOKS_API_KEY;
	const url = new URL(`https://www.googleapis.com/books/v1/volumes/${id}`);
	if (apiKey) {
		url.searchParams.set("key", apiKey);
	}
	const data = await fetchJson<GoogleBooksItem>(url.toString());

	return {
		source: "google-books",
		id,
		title: data.volumeInfo.title,
		subtitle: data.volumeInfo.subtitle,
		creator: data.volumeInfo.authors?.join(", "),
		year: parseYear(data.volumeInfo.publishedDate),
		coverUrl: pickGoogleCover(data.volumeInfo.imageLinks),
		pages: data.volumeInfo.pageCount,
		publisher: data.volumeInfo.publisher,
		publishedDate: data.volumeInfo.publishedDate,
		language: data.volumeInfo.language,
		isbn10: getGoogleIndustryIdentifier(data.volumeInfo, "ISBN_10"),
		isbn13: getGoogleIndustryIdentifier(data.volumeInfo, "ISBN_13"),
		categories: data.volumeInfo.categories,
		description: stripHtml(data.volumeInfo.description),
		canonicalUrl:
			data.volumeInfo.canonicalVolumeLink ?? data.volumeInfo.infoLink,
	};
}

async function getOpenLibraryDetails(id: string): Promise<MetadataDetails> {
	const normalized = normalizeOpenLibraryId(id);

	if (normalized.startsWith("/books/")) {
		const data = await fetchJson<OpenLibraryEditionDetails>(
			`https://openlibrary.org${normalized}.json`,
		);
		const creator = await resolveOpenLibraryAuthors(data.authors);

		return {
			source: "open-library",
			id: normalized,
			title: data.title,
			subtitle: data.subtitle,
			creator,
			year: parseYear(data.publish_date),
			coverUrl: getOpenLibraryCoverUrl(data.covers?.[0]),
			pages: data.number_of_pages,
			publisher: data.publishers?.[0],
			publishedDate: data.publish_date,
			language: await resolveOpenLibraryLanguage(data.languages?.[0]?.key),
			isbn10: data.isbn_10?.[0],
			isbn13: data.isbn_13?.[0],
			categories: normalizeBookSubjects(data.subjects),
			canonicalUrl: `https://openlibrary.org${normalized}`,
		};
	}

	const data = await fetchJson<OpenLibraryWorkDetails>(
		`https://openlibrary.org${normalized}.json`,
	);
	const creator = await resolveOpenLibraryAuthors(data.authors);
	const bestEdition = await getBestOpenLibraryEdition(normalized);

	return {
		source: "open-library",
		id: normalized,
		title: data.title,
		subtitle: data.subtitle,
		creator,
		year:
			parseYear(data.first_publish_date) ??
			parseYear(bestEdition?.publish_date),
		coverUrl:
			getOpenLibraryCoverUrl(data.covers?.[0]) ??
			getOpenLibraryCoverUrl(bestEdition?.covers?.[0]),
		pages: bestEdition?.number_of_pages,
		publisher: bestEdition?.publishers?.[0],
		publishedDate: data.first_publish_date ?? bestEdition?.publish_date,
		language: await resolveOpenLibraryLanguage(
			bestEdition?.languages?.[0]?.key,
		),
		isbn10: bestEdition?.isbn_10?.[0],
		isbn13: bestEdition?.isbn_13?.[0],
		categories: normalizeBookSubjects(data.subjects),
		canonicalUrl: `https://openlibrary.org${normalized}`,
	};
}

async function getTmdbDetails(
	id: string,
	obraType?: ObraType,
): Promise<MetadataDetails> {
	const apiKey = process.env.TMDB_API_KEY;
	if (!apiKey) {
		throw new Error("Falta configurar TMDB_API_KEY.");
	}

	const isMovie = obraType === "movie";
	const endpoint = isMovie ? "movie" : "tv";
	const detailUrl = new URL(`https://api.themoviedb.org/3/${endpoint}/${id}`);
	detailUrl.searchParams.set("api_key", apiKey);
	detailUrl.searchParams.set("language", "es-ES");

	const data = await fetchJson<TmdbDetails>(detailUrl.toString());
	let watchProviders: string[] | undefined;
	if (isMovie) {
		try {
			const providersUrl = new URL(
				`https://api.themoviedb.org/3/${endpoint}/${id}/watch/providers`,
			);
			providersUrl.searchParams.set("api_key", apiKey);
			const providersData = await fetchJson<TmdbWatchProviders>(
				providersUrl.toString(),
			);
			watchProviders =
				providersData.results?.CL?.flatrate?.map(
					(provider) => provider.provider_name,
				) ?? [];
		} catch (error) {
			void error;
		}
	}

	return {
		source: "tmdb",
		id,
		title: data.title ?? data.name ?? undefined,
		year: parseYear(data.release_date ?? data.first_air_date),
		coverUrl: data.poster_path
			? `https://image.tmdb.org/t/p/original${data.poster_path}`
			: undefined,
		status: data.status ?? undefined,
		seasons: data.number_of_seasons,
		episodes: data.number_of_episodes,
		nextEpisodeDate: data.next_episode_to_air?.air_date
			? new Date(data.next_episode_to_air.air_date).getTime()
			: undefined,
		runtime: data.runtime ?? data.episode_run_time?.[0],
		watchProviders,
	};
}

async function getAnilistDetails(
	id: string,
	obraType?: ObraType,
): Promise<MetadataDetails> {
	const response = await fetchJson<AnilistDetailsResponse>(
		"https://graphql.anilist.co",
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				query: ANILIST_DETAILS_QUERY,
				variables: {
					id: Number(id),
				},
			}),
		},
	);

	const media = response.data.Media;
	const nextEpisode = media.nextAiringEpisode;
	const latestChapterInfo =
		obraType === "manga" || obraType === "manhwa"
			? await resolveLatestMangaChapter(media)
			: undefined;
	const resolvedChapter =
		latestChapterInfo?.latestChapter ??
		(typeof media.chapters === "number" ? media.chapters : undefined);

	return {
		source: "anilist",
		id: String(media.id),
		title:
			media.title.english ??
			media.title.romaji ??
			media.title.native ??
			undefined,
		creator: getAnilistCreator(media, obraType),
		year: media.startDate?.year ?? undefined,
		coverUrl: media.coverImage?.extraLarge ?? media.coverImage?.large,
		season: media.season ?? undefined,
		seasonYear: media.seasonYear ?? undefined,
		status: media.status ?? undefined,
		episodes: media.episodes ?? undefined,
		volumes: media.volumes ?? undefined,
		episodesAired: nextEpisode?.episode
			? Math.max(nextEpisode.episode - 1, 0)
			: undefined,
		nextEpisodeDate: nextEpisode?.airingAt
			? nextEpisode.airingAt * 1000
			: undefined,
		latestChapter: resolvedChapter,
		latestChapterSource: latestChapterInfo?.source,
		latestChapterCheckedAt: latestChapterInfo?.checkedAt,
		mangaPlusTitleId: latestChapterInfo?.mangaPlusTitleId,
		mangaDexId: latestChapterInfo?.mangaDexId,
	};
}

type MangaChapterSource = "manga-plus" | "mangadex" | "anilist";

interface MangaLatestChapterInfo {
	latestChapter?: number;
	source?: MangaChapterSource;
	checkedAt: number;
	mangaPlusTitleId?: string;
	mangaDexId?: string;
}

async function resolveLatestMangaChapter(
	media: AnilistDetailsResponse["data"]["Media"],
) {
	const checkedAt = Date.now();
	const mangaPlusTitleId = extractMangaPlusTitleId(media.externalLinks);

	if (mangaPlusTitleId) {
		const mangaPlusChapter = await getMangaPlusLatestChapter(mangaPlusTitleId);
		if (mangaPlusChapter !== undefined) {
			return {
				latestChapter: mangaPlusChapter,
				source: "manga-plus" as const,
				checkedAt,
				mangaPlusTitleId,
			} satisfies MangaLatestChapterInfo;
		}
	}

	const mangaDexInfo = await resolveMangaDexLatestChapter(media);
	if (mangaDexInfo?.latestChapter !== undefined) {
		return {
			latestChapter: mangaDexInfo.latestChapter,
			source: "mangadex" as const,
			checkedAt,
			mangaPlusTitleId,
			mangaDexId: mangaDexInfo.mangaDexId,
		} satisfies MangaLatestChapterInfo;
	}

	if (typeof media.chapters === "number") {
		return {
			latestChapter: media.chapters,
			source: "anilist" as const,
			checkedAt,
			mangaPlusTitleId,
			mangaDexId: mangaDexInfo?.mangaDexId,
		} satisfies MangaLatestChapterInfo;
	}

	if (mangaPlusTitleId || mangaDexInfo?.mangaDexId) {
		return {
			checkedAt,
			mangaPlusTitleId,
			mangaDexId: mangaDexInfo?.mangaDexId,
		};
	}

	return undefined;
}

function extractMangaPlusTitleId(
	externalLinks?: Array<{ site?: string; url?: string }> | null,
) {
	if (!externalLinks?.length) return undefined;

	for (const link of externalLinks) {
		if (!link?.url) continue;
		if (!link.site?.toLowerCase().includes("manga plus")) continue;
		const match = link.url.match(/\/titles\/(\d+)/i);
		if (match?.[1]) return match[1];
	}

	return undefined;
}

async function getMangaPlusLatestChapter(titleId: string) {
	try {
		const response = await fetchJson<MangaPlusTitleDetailResponse>(
			`https://jumpg-webapi.tokyo-cdn.com/api/title_detailV3?title_id=${encodeURIComponent(titleId)}&format=json`,
		);
		const groups = response?.success?.titleDetailView?.chapterListGroup ?? [];
		const chapters = groups.flatMap((group) => [
			...(group.firstChapterList ?? []),
			...(group.midChapterList ?? []),
			...(group.lastChapterList ?? []),
		]);
		const numbers = chapters
			.map((chapter) => {
				return (
					parseChapterNumber(chapter.name) ??
					parseChapterNumber(chapter.subTitle)
				);
			})
			.filter((value): value is number => value !== undefined);

		if (!numbers.length) return undefined;
		return Math.max(...numbers);
	} catch (error) {
		void error;
		return undefined;
	}
}

async function resolveMangaDexLatestChapter(
	media: AnilistDetailsResponse["data"]["Media"],
) {
	const primaryTitle =
		media.title.english ?? media.title.romaji ?? media.title.native ?? "";
	if (!primaryTitle) return undefined;

	try {
		const searchUrl = new URL("https://api.mangadex.org/manga");
		searchUrl.searchParams.set("title", primaryTitle);
		searchUrl.searchParams.set("limit", "20");

		const response = await fetchJson<MangaDexSearchResponse>(
			searchUrl.toString(),
		);
		const candidates = response.data ?? [];
		const selected = pickMangaDexCandidate(candidates, media);
		if (!selected) return undefined;

		const latestChapter =
			parseChapterNumber(selected.attributes?.lastChapter) ??
			(await getMangaDexLatestFromChapterFeed(selected.id));

		return {
			latestChapter,
			mangaDexId: selected.id,
		};
	} catch (error) {
		void error;
		return undefined;
	}
}

function pickMangaDexCandidate(
	candidates: MangaDexManga[],
	media: AnilistDetailsResponse["data"]["Media"],
) {
	if (!candidates.length) return undefined;

	const anilistId = String(media.id);
	const malId = media.idMal ? String(media.idMal) : undefined;

	const byAnilistLink = candidates.find(
		(candidate) => candidate.attributes?.links?.al === anilistId,
	);
	if (byAnilistLink) return byAnilistLink;

	if (malId) {
		const byMalLink = candidates.find(
			(candidate) => candidate.attributes?.links?.mal === malId,
		);
		if (byMalLink) return byMalLink;
	}

	const normalizedTarget = normalizeTitle(
		media.title.english ?? media.title.romaji ?? media.title.native,
	);
	if (!normalizedTarget) return undefined;

	return candidates.find((candidate) => {
		const titles = [
			...Object.values(candidate.attributes?.title ?? {}),
			...(candidate.attributes?.altTitles ?? []).flatMap((entry) =>
				Object.values(entry),
			),
		];
		return titles.some((title) => normalizeTitle(title) === normalizedTarget);
	});
}

function normalizeTitle(value?: string) {
	if (!value) return "";
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "")
		.trim();
}

async function getMangaDexLatestFromChapterFeed(mangaId: string) {
	const url = new URL("https://api.mangadex.org/chapter");
	url.searchParams.set("manga", mangaId);
	url.searchParams.set("limit", "10");
	url.searchParams.set("order[readableAt]", "desc");

	try {
		const response = await fetchJson<MangaDexChapterResponse>(url.toString());
		const chapterNumbers = (response.data ?? [])
			.map((chapter) => parseChapterNumber(chapter.attributes?.chapter))
			.filter((value): value is number => value !== undefined);

		if (!chapterNumbers.length) return undefined;
		return Math.max(...chapterNumbers);
	} catch (error) {
		void error;
		return undefined;
	}
}

function parseChapterNumber(value?: string | null) {
	if (!value) return undefined;
	const match = value.match(/(\d+(?:\.\d+)?)/);
	if (!match?.[1]) return undefined;
	const parsed = Number(match[1]);
	return Number.isFinite(parsed) ? parsed : undefined;
}

export async function getMetadataDetails(
	source: MetadataSource,
	id: string,
	obraType?: ObraType,
) {
	const cacheKey = `${DETAILS_CACHE_VERSION}:${source}:${id}:${obraType ?? ""}`;
	const cached = detailsCache.get(cacheKey);
	const shouldBypassCachedManga =
		source === "anilist" &&
		(obraType === "manga" || obraType === "manhwa") &&
		cached?.value.status === "RELEASING" &&
		cached.value.latestChapter === undefined;

	if (cached && cached.expiresAt > Date.now() && !shouldBypassCachedManga) {
		return cached.value;
	}

	await enforceRateLimit(source);
	let details: MetadataDetails;

	switch (source) {
		case "google-books":
			details = await getGoogleBookDetails(id);
			break;
		case "open-library":
			details = await getOpenLibraryDetails(id);
			break;
		case "apple-books":
			details = await getAppleBookDetails(id);
			break;
		case "tmdb":
			details = await getTmdbDetails(id, obraType);
			break;
		case "anilist":
			details = await getAnilistDetails(id, obraType);
			break;
	}

	detailsCache.set(cacheKey, {
		expiresAt: Date.now() + CACHE_TTL_MS,
		value: details,
	});

	return details;
}

async function fetchJson<T>(url: string, init?: RequestInit) {
	const response = await fetch(url, init);
	if (!response.ok) {
		const details = await readMetadataErrorDetails(response);
		const message = getMetadataErrorMessage(response, url, details);
		const error = new Error(message) as Error & {
			status?: number;
			url?: string;
			metadata?: { reason?: string };
		};
		error.status = response.status;
		error.url = url;
		if (details?.reason) {
			error.metadata = { reason: details.reason };
		}
		throw error;
	}
	return (await response.json()) as T;
}

function getMetadataErrorMessage(
	response: Response,
	url: string,
	details?: Awaited<ReturnType<typeof readMetadataErrorDetails>>,
) {
	const fallback = "No se pudo consultar metadatos.";
	const detail = details?.message;

	if (response.status === 403 && url.includes("googleapis.com/books")) {
		if (
			details?.reason === "quotaExceeded" ||
			isGoogleBooksQuotaMessage(detail)
		) {
			return "Google Books agotó su cuota diaria. Configura GOOGLE_BOOKS_API_KEY o usa Open Library.";
		}

		return (
			detail ??
			"Google Books requiere una API key para esta IP. Configura GOOGLE_BOOKS_API_KEY."
		);
	}

	if (detail) {
		return detail;
	}

	return `${fallback} (HTTP ${response.status}).`;
}

async function readMetadataErrorDetails(response: Response) {
	try {
		const text = await response.text();
		if (!text) return undefined;

		const payload = JSON.parse(text) as {
			error?:
				| string
				| {
						message?: string;
						errors?: Array<{
							reason?: string;
						}>;
				  };
		};

		if (!payload?.error) return undefined;

		if (typeof payload.error === "string") {
			return { message: payload.error };
		}

		return {
			message: payload.error.message,
			reason: payload.error.errors?.[0]?.reason,
		};
	} catch {
		return undefined;
	}
}

function isGoogleBooksQuotaError(error: unknown) {
	if (!(error instanceof Error)) return false;

	const metadataError = error as Error & {
		status?: number;
		url?: string;
		metadata?: { reason?: string };
	};
	const message = error.message;
	const reason = metadataError.metadata?.reason?.toLowerCase();

	return Boolean(
		metadataError.url?.includes("googleapis.com/books") &&
			(metadataError.status === 403 || metadataError.status === 429) &&
			(isGoogleBooksQuotaMessage(message) ||
				reason === "quotaexceeded" ||
				reason === "dailylimitexceeded" ||
				reason === "userratelimitexceeded"),
	);
}

function isGoogleBooksQuotaMessage(message?: string) {
	if (!message) return false;
	const normalized = message.toLowerCase();
	return Boolean(
		normalized.includes("quota") ||
			normalized.includes("rate limit") ||
			normalized.includes("daily limit") ||
			normalized.includes("queries per day"),
	);
}

function parseYear(value?: string) {
	if (!value) return undefined;
	const match = value.match(/\d{4}/);
	return match ? Number(match[0]) : undefined;
}

function mapGoogleBookItem(item: GoogleBooksItem): MetadataSearchResult {
	return {
		source: "google-books",
		id: item.id,
		title: item.volumeInfo.title,
		subtitle: item.volumeInfo.subtitle,
		creator: item.volumeInfo.authors?.join(", "),
		year: parseYear(item.volumeInfo.publishedDate),
		coverUrl: pickGoogleCover(item.volumeInfo.imageLinks),
		pages: item.volumeInfo.pageCount,
		publisher: item.volumeInfo.publisher,
		publishedDate: item.volumeInfo.publishedDate,
		language: item.volumeInfo.language,
		isbn10: getGoogleIndustryIdentifier(item.volumeInfo, "ISBN_10"),
		isbn13: getGoogleIndustryIdentifier(item.volumeInfo, "ISBN_13"),
		categories: item.volumeInfo.categories,
		description: stripHtml(item.volumeInfo.description),
		canonicalUrl:
			item.volumeInfo.canonicalVolumeLink ?? item.volumeInfo.infoLink,
	};
}

function mapAppleBookItem(item: AppleBooksItem): MetadataSearchResult {
	return {
		source: "apple-books",
		id: String(item.trackId),
		title: item.trackName,
		creator: item.artistName,
		year: parseYear(item.releaseDate),
		coverUrl: upgradeAppleArtwork(item.artworkUrl100),
		publisher: item.publisher,
		publishedDate: item.releaseDate?.slice(0, 10),
		language: item.language,
		categories: item.genres,
		description: stripHtml(item.description),
		canonicalUrl: item.trackViewUrl,
	};
}

async function getAppleBookDetails(id: string): Promise<MetadataDetails> {
	const url = new URL("https://itunes.apple.com/lookup");
	url.searchParams.set("id", id);
	url.searchParams.set("entity", "ebook");
	url.searchParams.set("country", "ES");

	const data = await fetchJson<AppleBooksSearchResponse>(url.toString());
	const item = data.results?.[0];
	if (!item) throw new Error("No se encontraron metadatos en Apple Books.");
	const details = mapAppleBookItem(item);
	return enrichAppleBookResult(details);
}

function upgradeAppleArtwork(url?: string) {
	return url?.replace(/\/\d+x\d+bb\.jpg$/i, "/600x900bb.jpg");
}

async function searchGoogleBooksForEnrichment(input: {
	isbn13?: string;
	title: string;
	creator?: string;
}) {
	const queries = [
		input.isbn13 ? `isbn:${input.isbn13}` : undefined,
		[input.title, input.creator].filter(Boolean).join(" "),
	].filter((value): value is string => Boolean(value));

	for (const query of queries) {
		try {
			const outcome = await searchGoogleBooks(query);
			if (outcome.results.length > 0) return outcome.results;
		} catch (error) {
			if (isGoogleBooksQuotaError(error)) return [];
			throw error;
		}
	}

	return [];
}

function selectBestGoogleBookMatch(
	candidates: MetadataSearchResult[],
	target: MetadataSearchResult,
) {
	const targetTitle = normalizeTitle(target.title);
	const targetCreator = normalizeTitle(target.creator);
	return candidates.find((candidate) => {
		const sameIsbn =
			Boolean(target.isbn13) && candidate.isbn13 === target.isbn13;
		const sameTitle = normalizeTitle(candidate.title) === targetTitle;
		const sameCreator =
			!targetCreator || normalizeTitle(candidate.creator) === targetCreator;
		return sameIsbn || (sameTitle && sameCreator);
	});
}

function mergeBookMetadata(
	base: MetadataSearchResult | MetadataDetails,
	enrichment: MetadataSearchResult,
): MetadataSearchResult {
	return {
		...enrichment,
		...base,
		pages: base.pages ?? enrichment.pages,
		subtitle: base.subtitle ?? enrichment.subtitle,
		publisher: base.publisher ?? enrichment.publisher,
		publishedDate: base.publishedDate ?? enrichment.publishedDate,
		language: base.language ?? enrichment.language,
		isbn10: base.isbn10 ?? enrichment.isbn10,
		isbn13: base.isbn13 ?? enrichment.isbn13,
		categories: base.categories?.length
			? base.categories
			: enrichment.categories,
		description: base.description ?? enrichment.description,
		canonicalUrl: base.canonicalUrl ?? enrichment.canonicalUrl,
		coverUrl: pickMergedBookCover(base, enrichment),
	};
}

function pickMergedBookCover(
	base: MetadataSearchResult | MetadataDetails,
	enrichment: MetadataSearchResult,
) {
	if (!enrichment.coverUrl) return base.coverUrl;
	if (!base.coverUrl) return enrichment.coverUrl;
	if (
		base.source === "google-books" &&
		(enrichment.source === "apple-books" ||
			enrichment.source === "open-library")
	) {
		return enrichment.coverUrl;
	}
	return base.coverUrl;
}

function extractAppleBookIsbn(
	result: Pick<MetadataSearchResult, "source" | "coverUrl" | "canonicalUrl">,
) {
	if (result.source !== "apple-books") return undefined;
	for (const value of [result.coverUrl, result.canonicalUrl]) {
		const match = value?.match(/(?:^|\/)(97[89]\d{10})(?:[/.?]|$)/);
		if (match?.[1]) return match[1];
	}
	return undefined;
}

function dedupeBookResults(results: MetadataSearchResult[]) {
	const indexByKey = new Map<string, number>();
	const deduped: MetadataSearchResult[] = [];

	for (const result of results) {
		const keys = getBookResultMergeKeys(result);
		const existingIndex = keys
			.map((key) => indexByKey.get(key))
			.find((index): index is number => index !== undefined);

		if (existingIndex !== undefined) {
			deduped[existingIndex] = mergeBookMetadata(
				deduped[existingIndex],
				result,
			);
			for (const key of getBookResultMergeKeys(deduped[existingIndex])) {
				indexByKey.set(key, existingIndex);
			}
			continue;
		}

		const index = deduped.length;
		for (const key of keys) {
			indexByKey.set(key, index);
		}
		deduped.push(result);
	}

	return deduped.sort((a, b) => getBookResultScore(b) - getBookResultScore(a));
}

function getBookResultMergeKeys(result: MetadataSearchResult) {
	return [
		result.isbn13 ? `isbn13:${normalizeIsbn(result.isbn13)}` : undefined,
		result.isbn10 ? `isbn10:${normalizeIsbn(result.isbn10)}` : undefined,
		`${normalizeTitle(result.title)}:${normalizeTitle(result.creator)}`,
	].filter((key): key is string => Boolean(key));
}

function getBookResultScore(result: MetadataSearchResult) {
	let score = 0;
	if (result.coverUrl) score += 3;
	if (result.isbn13) score += 3;
	if (result.isbn10) score += 2;
	if (result.pages) score += 2;
	if (result.publisher) score += 1;
	if (result.description) score += 1;
	if (result.source === "google-books") score += 1;
	return score;
}

function getGoogleIndustryIdentifier(
	volumeInfo: GoogleBooksItem["volumeInfo"],
	type: "ISBN_10" | "ISBN_13",
) {
	return volumeInfo.industryIdentifiers?.find(
		(identifier) => identifier.type === type,
	)?.identifier;
}

function pickIsbn(values: string[] | undefined, length: 10 | 13) {
	return values?.find((value) => normalizeIsbn(value).length === length);
}

function normalizeIsbn(value: string) {
	return value.replace(/[^0-9X]/gi, "").toUpperCase();
}

function normalizeBookSubjects(subjects?: string[]) {
	return subjects
		?.map((subject) => subject.trim())
		.filter(Boolean)
		.slice(0, 8);
}

function stripHtml(value?: string) {
	if (!value) return undefined;
	return value
		.replace(/<br\s*\/?>/gi, "\n")
		.replace(/<[^>]+>/g, "")
		.replace(/&nbsp;/g, " ")
		.replace(/&amp;/g, "&")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.trim();
}

function getOpenLibrarySearchResultId(
	doc: NonNullable<OpenLibraryResponse["docs"]>[number],
) {
	const editionId = doc.cover_edition_key ?? doc.edition_key?.[0];
	if (editionId) return `/books/${editionId}`;
	return normalizeOpenLibraryId(doc.key);
}

function normalizeOpenLibraryId(id: string) {
	const normalized = id.startsWith("/") ? id : `/${id}`;
	if (normalized.startsWith("/books/") || normalized.startsWith("/works/")) {
		return normalized;
	}

	const olid = normalized.replace(/^\//, "");
	if (/^OL\d+M$/i.test(olid)) return `/books/${olid}`;
	if (/^OL\d+W$/i.test(olid)) return `/works/${olid}`;
	return normalized;
}

async function resolveOpenLibraryLanguage(key?: string) {
	if (!key) return undefined;
	try {
		const normalized = key.startsWith("/") ? key : `/languages/${key}`;
		const language = await fetchJson<OpenLibraryLanguageDetails>(
			`https://openlibrary.org${normalized}.json`,
		);
		return language.name;
	} catch {
		return key.split("/").pop();
	}
}

function getOpenLibraryCoverUrl(coverId?: number) {
	return coverId
		? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`
		: undefined;
}

async function getBestOpenLibraryEdition(workId: string) {
	try {
		const url = new URL(`https://openlibrary.org${workId}/editions.json`);
		url.searchParams.set("limit", "10");
		const data = await fetchJson<OpenLibraryEditionsResponse>(url.toString());
		const editions = data.entries ?? [];
		return (
			editions.find(
				(edition) =>
					edition.number_of_pages !== undefined &&
					(edition.publish_date || edition.covers?.length),
			) ??
			editions.find((edition) => edition.number_of_pages !== undefined) ??
			editions.find((edition) => edition.publish_date || edition.covers?.length)
		);
	} catch {
		return undefined;
	}
}

async function resolveOpenLibraryAuthors(
	authors?: Array<{ key?: string } | { author?: { key?: string } }>,
) {
	const keys = authors
		?.map((entry) => {
			if ("author" in entry) return entry.author?.key;
			return (entry as { key?: string }).key;
		})
		.filter((key): key is string => Boolean(key))
		.slice(0, 3);

	if (!keys?.length) return undefined;

	try {
		const names = await Promise.all(
			keys.map(async (key) => {
				const normalized = key.startsWith("/") ? key : `/authors/${key}`;
				const author = await fetchJson<OpenLibraryAuthorDetails>(
					`https://openlibrary.org${normalized}.json`,
				);
				return author.name;
			}),
		);
		const resolved = names.filter((name): name is string => Boolean(name));
		return resolved.length ? resolved.join(", ") : undefined;
	} catch {
		return undefined;
	}
}

function pickGoogleCover(
	imageLinks?: GoogleBooksItem["volumeInfo"]["imageLinks"],
) {
	const coverUrl =
		imageLinks?.extraLarge ??
		imageLinks?.large ??
		imageLinks?.medium ??
		imageLinks?.small ??
		imageLinks?.thumbnail;
	return coverUrl ? upgradeGoogleCover(coverUrl) : undefined;
}

function upgradeGoogleCover(url: string) {
	return url.replace(/zoom=\d+/g, "zoom=2");
}

interface GoogleBooksItem {
	id: string;
	volumeInfo: {
		title: string;
		subtitle?: string;
		authors?: string[];
		publisher?: string;
		publishedDate?: string;
		description?: string;
		industryIdentifiers?: Array<{
			type?: string;
			identifier?: string;
		}>;
		pageCount?: number;
		categories?: string[];
		language?: string;
		infoLink?: string;
		canonicalVolumeLink?: string;
		imageLinks?: {
			thumbnail?: string;
			small?: string;
			medium?: string;
			large?: string;
			extraLarge?: string;
		};
	};
}

interface OpenLibraryResponse {
	docs?: Array<{
		key: string;
		title: string;
		author_name?: string[];
		first_publish_year?: number;
		number_of_pages_median?: number;
		cover_i?: number;
		edition_key?: string[];
		cover_edition_key?: string;
		isbn?: string[];
		publisher?: string[];
		language?: string[];
	}>;
}

interface OpenLibraryEditionDetails {
	title?: string;
	subtitle?: string;
	number_of_pages?: number;
	publish_date?: string;
	covers?: number[];
	publishers?: string[];
	languages?: Array<{ key?: string }>;
	isbn_10?: string[];
	isbn_13?: string[];
	subjects?: string[];
	authors?: Array<{ key?: string }>;
}

interface OpenLibraryWorkDetails {
	title?: string;
	subtitle?: string;
	first_publish_date?: string;
	covers?: number[];
	subjects?: string[];
	authors?: Array<{ author?: { key?: string } }>;
}

interface OpenLibraryEditionsResponse {
	entries?: OpenLibraryEditionDetails[];
}

interface OpenLibraryAuthorDetails {
	name?: string;
}

interface OpenLibraryLanguageDetails {
	name?: string;
}

interface AppleBooksSearchResponse {
	results?: AppleBooksItem[];
}

interface AppleBooksItem {
	trackId: number;
	trackName: string;
	artistName?: string;
	releaseDate?: string;
	description?: string;
	genres?: string[];
	language?: string;
	publisher?: string;
	trackViewUrl?: string;
	artworkUrl100?: string;
}

interface TmdbResult {
	id: number;
	name?: string;
	title?: string;
	first_air_date?: string;
	release_date?: string;
	poster_path?: string | null;
}

interface TmdbDetails {
	title?: string;
	name?: string;
	release_date?: string;
	first_air_date?: string;
	poster_path?: string | null;
	status?: string;
	number_of_seasons?: number;
	number_of_episodes?: number;
	runtime?: number | null;
	episode_run_time?: number[] | null;
	next_episode_to_air?: {
		episode_number?: number;
		air_date?: string;
	} | null;
}

interface TmdbWatchProviders {
	results?: {
		CL?: {
			flatrate?: Array<{
				provider_name: string;
			}>;
		};
	};
}

interface MangaPlusTitleDetailResponse {
	success?: {
		titleDetailView?: {
			chapterListGroup?: Array<{
				firstChapterList?: MangaPlusChapter[];
				midChapterList?: MangaPlusChapter[];
				lastChapterList?: MangaPlusChapter[];
			}>;
		};
	};
}

interface MangaPlusChapter {
	name?: string;
	subTitle?: string;
}

interface MangaDexSearchResponse {
	data?: MangaDexManga[];
}

interface MangaDexManga {
	id: string;
	attributes?: {
		title?: Record<string, string>;
		altTitles?: Array<Record<string, string>>;
		lastChapter?: string | null;
		links?: {
			al?: string;
			mal?: string;
		};
	};
}

interface MangaDexChapterResponse {
	data?: Array<{
		attributes?: {
			chapter?: string | null;
		};
	}>;
}

interface AnilistResponse {
	data: {
		Page: {
			media?: Array<{
				id: number;
				title: {
					romaji?: string;
					english?: string;
					native?: string;
				};
				coverImage?: {
					extraLarge?: string;
					large?: string;
				};
				studios?: {
					nodes?: Array<{
						name?: string;
					}>;
				};
				staff?: {
					edges?: Array<{
						role?: string;
						node?: {
							name?: {
								full?: string;
							};
						};
					}>;
				};
				startDate?: {
					year?: number;
				};
				episodes?: number;
				chapters?: number;
				volumes?: number;
				status?: string;
				season?: string;
				seasonYear?: number;
			}>;
		};
	};
}

interface AnilistDetailsResponse {
	data: {
		Media: {
			id: number;
			idMal?: number;
			title: {
				romaji?: string;
				english?: string;
				native?: string;
			};
			coverImage?: {
				extraLarge?: string;
				large?: string;
			};
			startDate?: {
				year?: number;
			};
			studios?: {
				nodes?: Array<{
					name?: string;
				}>;
			};
			staff?: {
				edges?: Array<{
					role?: string;
					node?: {
						name?: {
							full?: string;
						};
					};
				}>;
			};
			season?: string;
			seasonYear?: number;
			status?: string;
			episodes?: number;
			chapters?: number;
			volumes?: number;
			nextAiringEpisode?: {
				episode?: number;
				airingAt?: number;
			} | null;
			externalLinks?: Array<{
				site?: string;
				url?: string;
			}>;
		};
	};
}

function getAnilistCreator(
	media: {
		studios?: { nodes?: Array<{ name?: string }> };
		staff?: {
			edges?: Array<{
				role?: string;
				node?: { name?: { full?: string } };
			}>;
		};
	},
	obraType?: ObraType,
) {
	const studioName = media.studios?.nodes?.find((node) => node?.name)?.name;
	const staffEdges = media.staff?.edges ?? [];
	const staffName = pickStaffName(staffEdges, obraType);

	if (obraType === "anime") {
		return studioName ?? staffName;
	}

	return staffName ?? studioName;
}

function pickStaffName(
	edges: Array<{
		role?: string;
		node?: { name?: { full?: string } };
	}>,
	obraType?: ObraType,
) {
	const rolePriority =
		obraType === "anime"
			? ["director", "original creator", "creator"]
			: [
					"story",
					"story & art",
					"story and art",
					"original creator",
					"creator",
					"author",
				];

	for (const role of rolePriority) {
		const match = edges.find((edge) => edge.role?.toLowerCase().includes(role));
		const name = match?.node?.name?.full;
		if (name) return name;
	}

	return edges.find((edge) => edge.node?.name?.full)?.node?.name?.full;
}

const ANILIST_QUERY = `
query ($search: String, $type: MediaType) {
  Page(perPage: 6) {
    media(search: $search, type: $type) {
      id
      title {
        romaji
        english
        native
      }
      coverImage {
        extraLarge
        large
      }
      studios(isMain: true) {
        nodes {
          name
        }
      }
      staff(perPage: 3) {
        edges {
          role
          node {
            name {
              full
            }
          }
        }
      }
      startDate {
        year
      }
      episodes
      chapters
      volumes
      status
      season
      seasonYear
    }
  }
}
`;

const ANILIST_DETAILS_QUERY = `
query ($id: Int) {
  Media(id: $id) {
    id
    idMal
    title {
      romaji
      english
      native
    }
    coverImage {
      extraLarge
      large
    }
    startDate {
      year
    }
    studios(isMain: true) {
      nodes {
        name
      }
    }
    staff(perPage: 6) {
      edges {
        role
        node {
          name {
            full
          }
        }
      }
    }
    season
    seasonYear
    status
    episodes
    chapters
    volumes
    nextAiringEpisode {
      episode
      airingAt
    }
    externalLinks {
      site
      url
    }
  }
}
`;
