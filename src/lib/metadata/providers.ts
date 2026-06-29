import type { ObraType } from "@/lib/types";
import type {
	MangaChapterSource,
	MetadataDetails,
	MetadataDirectUrlFallback,
	MetadataSearchResult,
	MetadataSource,
} from "./types";

const CACHE_TTL_MS = 5 * 60 * 1000;
const MANHWA_WEB_IMAGE_HOSTS = new Set(["img1mw.xyz", "img2mw.xyz"]);
const MANHWA_WEB_IMAGE_PROXY_PATH = "/api/metadata/image";

const providerRateLimits: Record<MetadataSource, number> = {
	"google-books": 250,
	"open-library": 250,
	"apple-books": 250,
	amazon: 1000,
	tmdb: 300,
	anilist: 300,
	manhwaweb: 500,
};

const providerCache = new Map<
	string,
	{ expiresAt: number; value: MetadataSearchOutcome }
>();

const detailsCache = new Map<
	string,
	{ expiresAt: number; value: MetadataDetails }
>();

const DETAILS_CACHE_VERSION = "v3";

const providerLastRequest = new Map<MetadataSource, number>();

export interface MetadataSearchOutcome {
	provider: MetadataSource;
	results: MetadataSearchResult[];
	directUrlFallback?: MetadataDirectUrlFallback;
}

export const providerByType: Record<ObraType, MetadataSource> = {
	book: "google-books",
	movie: "tmdb",
	series: "tmdb",
	anime: "anilist",
	manga: "anilist",
	manhwa: "manhwaweb",
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
		return cached.value;
	}

	const outcome =
		(await resolveDirectUrlSearch(trimmedQuery, obraType)) ??
		(await searchMetadataForProvider(provider, trimmedQuery, obraType));

	const outcomeCacheKey = `${outcome.provider}:${trimmedQuery.toLowerCase()}:${obraType ?? ""}`;
	providerCache.set(cacheKey, {
		expiresAt: Date.now() + CACHE_TTL_MS,
		value: outcome,
	});
	providerCache.set(outcomeCacheKey, {
		expiresAt: Date.now() + CACHE_TTL_MS,
		value: outcome,
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
		case "amazon":
			return {
				provider: "amazon",
				results: await searchAmazonBooks(query, obraType),
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
		case "manhwaweb":
			return {
				provider: "manhwaweb",
				results: await searchManhwaWeb(query, obraType),
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

async function searchAmazonBooks(query: string, obraType?: ObraType) {
	if (obraType && obraType !== "book") return [];

	const directAsin = query.trim();
	const normalizedUrl = normalizeUrlCandidate(query);
	const asin = isAmazonAsin(directAsin)
		? directAsin
		: normalizedUrl
			? extractAmazonAsin(normalizedUrl)
			: undefined;
	if (!asin || !isAmazonAsin(asin)) return [];

	try {
		const normalizedAsin = asin.toUpperCase();
		const details = await getAmazonBookDetailsFromUrl(
			normalizedAsin,
			isAmazonAsin(directAsin)
				? `https://www.amazon.com/dp/${normalizedAsin}`
				: (normalizedUrl ?? `https://www.amazon.com/dp/${normalizedAsin}`),
		);
		return [metadataDetailsToSearchResult(details)];
	} catch {
		return [];
	}
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

async function searchManhwaWeb(query: string, obraType?: ObraType) {
	const directId = extractManhwaWebId(query);
	if (directId) {
		try {
			const details = await getManhwaWebDetails(directId, obraType);
			return [metadataDetailsToSearchResult(details)];
		} catch (error) {
			void error;
		}
	}

	const url = new URL(
		"https://manhwawebbackend-production.up.railway.app/manhwa/library",
	);
	url.searchParams.set("buscar", query);
	const response = await fetchJson<ManhwaWebSearchResponse>(url.toString());
	const results = (response.data ?? [])
		.filter((item) => isManhwaWebTypeMatch(item._tipo, obraType))
		.slice(0, 6)
		.map((item) => manhwaWebItemToSearchResult(item));

	return results;
}

async function resolveDirectUrlSearch(
	query: string,
	obraType?: ObraType,
): Promise<MetadataSearchOutcome | undefined> {
	const normalizedUrl = normalizeUrlCandidate(query);
	if (!normalizedUrl) return undefined;

	const manhwaWebId = extractManhwaWebId(normalizedUrl);
	if (manhwaWebId && (!obraType || obraType === "manhwa")) {
		try {
			const details = await getManhwaWebDetails(manhwaWebId, obraType);
			return {
				provider: "manhwaweb",
				results: [metadataDetailsToSearchResult(details)],
				directUrlFallback: buildDirectUrlFallback({
					url: details.canonicalUrl ?? normalizedUrl,
					label: "ManhwaWeb",
					identifier: manhwaWebId,
				}),
			};
		} catch {
			return undefined;
		}
	}

	if (!obraType || obraType === "book") {
		const googleBookId = extractGoogleBookId(normalizedUrl);
		if (googleBookId) {
			const details = await getMetadataDetails(
				"google-books",
				googleBookId,
				"book",
			);
			return {
				provider: "google-books",
				results: [metadataDetailsToSearchResult(details)],
				directUrlFallback: buildDirectUrlFallback({
					url: details.canonicalUrl ?? normalizedUrl,
					label: "Google Books",
					identifier: googleBookId,
				}),
			};
		}

		const openLibraryId = extractOpenLibraryBookId(normalizedUrl);
		if (openLibraryId) {
			const details = await getMetadataDetails(
				"open-library",
				openLibraryId,
				"book",
			);
			return {
				provider: "open-library",
				results: [metadataDetailsToSearchResult(details)],
				directUrlFallback: buildDirectUrlFallback({
					url: details.canonicalUrl ?? normalizedUrl,
					label: "Open Library",
					identifier: openLibraryId,
				}),
			};
		}

		const appleBookId = extractAppleBookId(normalizedUrl);
		if (appleBookId) {
			const details = await getMetadataDetails(
				"apple-books",
				appleBookId,
				"book",
			);
			return {
				provider: "apple-books",
				results: [metadataDetailsToSearchResult(details)],
				directUrlFallback: buildDirectUrlFallback({
					url: details.canonicalUrl ?? normalizedUrl,
					label: "Apple Books",
					identifier: appleBookId,
				}),
			};
		}

		const amazonAsin = extractAmazonAsin(normalizedUrl);
		if (amazonAsin) {
			const canonicalUrl = `https://www.amazon.com/dp/${amazonAsin}`;
			await enforceRateLimit("amazon");
			const amazonDetails = await getAmazonBookDetailsFromUrl(
				amazonAsin,
				normalizedUrl,
			).catch(() => undefined);
			if (amazonDetails) {
				return {
					provider: "amazon",
					results: [metadataDetailsToSearchResult(amazonDetails)],
					directUrlFallback: buildDirectUrlFallback({
						url: amazonDetails.canonicalUrl ?? canonicalUrl,
						label: "Amazon",
						identifier: amazonAsin,
					}),
				};
			}

			const query = isIsbn10(amazonAsin) ? `isbn:${amazonAsin}` : amazonAsin;
			const results = await searchBookCatalog(query).catch(() => []);
			if (results.length) {
				return {
					provider: "google-books",
					results,
					directUrlFallback: buildDirectUrlFallback({
						url: canonicalUrl,
						label: "Amazon",
						identifier: amazonAsin,
					}),
				};
			}

			return {
				provider: "google-books",
				results: [],
				directUrlFallback: {
					url: canonicalUrl,
					label: "Amazon",
					identifier: amazonAsin,
					reason:
						"No encontré metadatos confiables para este enlace de Amazon.",
				},
			};
		}
	}

	const tmdbMatch = extractTmdbId(normalizedUrl);
	if (
		tmdbMatch &&
		((tmdbMatch.type === "movie" && obraType === "movie") ||
			(tmdbMatch.type === "tv" && obraType === "series") ||
			!obraType)
	) {
		const resolvedType = tmdbMatch.type === "movie" ? "movie" : "series";
		const details = await getMetadataDetails(
			"tmdb",
			tmdbMatch.id,
			resolvedType,
		);
		return {
			provider: "tmdb",
			results: [metadataDetailsToSearchResult(details)],
			directUrlFallback: buildDirectUrlFallback({
				url: normalizedUrl,
				label: "TMDB",
				identifier: tmdbMatch.id,
			}),
		};
	}

	const anilistMatch = extractAnilistId(normalizedUrl);
	if (
		anilistMatch &&
		((anilistMatch.type === "anime" && obraType === "anime") ||
			(anilistMatch.type === "manga" &&
				(obraType === "manga" || obraType === "manhwa")) ||
			!obraType)
	) {
		const resolvedType =
			obraType ?? (anilistMatch.type === "anime" ? "anime" : "manga");
		const details = await getMetadataDetails(
			"anilist",
			anilistMatch.id,
			resolvedType,
		);
		return {
			provider: "anilist",
			results: [metadataDetailsToSearchResult(details)],
			directUrlFallback: buildDirectUrlFallback({
				url: normalizedUrl,
				label: "AniList",
				identifier: anilistMatch.id,
			}),
		};
	}

	return undefined;
}

function buildDirectUrlFallback(input: {
	url: string;
	label: string;
	identifier?: string;
}): MetadataDirectUrlFallback {
	return {
		...input,
		reason: "Puedes crear la obra manualmente con este enlace cargado.",
	};
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

async function getManhwaWebDetails(
	id: string,
	obraType?: ObraType,
): Promise<MetadataDetails> {
	const normalizedId = extractManhwaWebId(id) ?? id.trim();
	if (!normalizedId) {
		throw new Error("ID de ManhwaWeb invalido.");
	}

	const data = await fetchJson<ManhwaWebDetails>(
		`https://manhwawebbackend-production.up.railway.app/manhwa/see/${encodeURIComponent(normalizedId)}`,
	);
	if (!isManhwaWebTypeMatch(data._tipo, obraType)) {
		throw new Error("La obra encontrada no coincide con el tipo seleccionado.");
	}

	const latestChapter =
		nullableChapter(data.numero_cap_esp) ??
		nullableChapter(data._numero_cap) ??
		getLatestManhwaWebChapter(data.chapters);
	const canonicalUrl = `https://www.manhwaweb.com/manhwa/${data.real_id ?? data._id}`;

	return {
		source: "manhwaweb",
		id: data.real_id ?? data._id,
		title: data.the_real_name ?? data.name_esp ?? data._name,
		creator: data._extras?.autores?.filter(Boolean).join(", ") || undefined,
		coverUrl: proxyManhwaWebImageUrl(data._imagen),
		description: data._sinopsis?.trim() || undefined,
		canonicalUrl,
		status: mapManhwaWebStatus(data._status),
		latestChapter,
		latestChapterSource: "scraping",
		latestChapterCheckedAt: Date.now(),
	};
}

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

export async function getMangaReadingUrlDetails(
	readingUrl: string | undefined,
	obraType?: ObraType,
): Promise<MetadataDetails | undefined> {
	if (!readingUrl || (obraType !== "manga" && obraType !== "manhwa")) {
		return undefined;
	}

	const normalizedUrl = normalizeReadingUrl(readingUrl);
	if (!normalizedUrl) return undefined;

	const manhwaWebId = extractManhwaWebId(normalizedUrl);
	if (manhwaWebId) {
		return await getManhwaWebDetails(manhwaWebId, obraType);
	}

	const mangaDexId = extractMangaDexTitleId(normalizedUrl);
	if (mangaDexId) {
		const latestChapter = await getMangaDexLatestFromChapterFeed(mangaDexId);
		if (latestChapter === undefined) return undefined;

		return {
			source: "anilist",
			id: mangaDexId,
			canonicalUrl: normalizedUrl,
			latestChapter,
			latestChapterSource: "scraping",
			latestChapterCheckedAt: Date.now(),
			mangaDexId,
		};
	}

	return await getCubariReadingUrlDetails(normalizedUrl);
}

async function getCubariReadingUrlDetails(
	readingUrl: string,
): Promise<MetadataDetails | undefined> {
	const manifestUrl = getCubariManifestUrl(readingUrl);
	if (!manifestUrl) return undefined;

	try {
		const manifest = await fetchJson<CubariManifest>(manifestUrl);
		const latestChapter = getLatestCubariChapter(manifest);
		if (latestChapter === undefined) return undefined;

		return {
			source: "anilist",
			id: manifestUrl,
			title: manifest.title,
			creator: manifest.author ?? manifest.artist,
			coverUrl: manifest.cover,
			canonicalUrl: readingUrl,
			latestChapter,
			latestChapterSource: "scraping",
			latestChapterCheckedAt: Date.now(),
		};
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
		case "amazon":
			details = await getAmazonBookDetails(id);
			break;
		case "tmdb":
			details = await getTmdbDetails(id, obraType);
			break;
		case "anilist":
			details = await getAnilistDetails(id, obraType);
			break;
		case "manhwaweb":
			details = await getManhwaWebDetails(id, obraType);
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

function normalizeUrlCandidate(value: string) {
	const trimmed = value.trim();
	if (!trimmed) return undefined;
	try {
		return new URL(trimmed).toString();
	} catch {
		try {
			return new URL(`https://${trimmed}`).toString();
		} catch {
			return undefined;
		}
	}
}

function extractGoogleBookId(value: string) {
	try {
		const url = new URL(value);
		const hostname = url.hostname.replace(/^www\./, "");
		if (
			hostname === "books.google.com" ||
			hostname.endsWith(".books.google.com") ||
			hostname === "play.google.com"
		) {
			const id = url.searchParams.get("id");
			return id?.trim() || undefined;
		}
		return undefined;
	} catch {
		return undefined;
	}
}

function extractOpenLibraryBookId(value: string) {
	try {
		const url = new URL(value);
		if (url.hostname.replace(/^www\./, "") !== "openlibrary.org") {
			return undefined;
		}
		const segments = url.pathname.split("/").filter(Boolean);
		if (segments.length < 2) return undefined;
		const [kind, id] = segments;
		if (
			(kind === "books" && /^OL\d+M$/i.test(id)) ||
			(kind === "works" && /^OL\d+W$/i.test(id))
		) {
			return `/${kind}/${id}`;
		}
		return undefined;
	} catch {
		return undefined;
	}
}

function extractAppleBookId(value: string) {
	try {
		const url = new URL(value);
		if (url.hostname.replace(/^www\./, "") !== "books.apple.com") {
			return undefined;
		}
		for (const segment of url.pathname.split("/").filter(Boolean)) {
			const match = segment.match(/^id(\d+)$/i);
			if (match?.[1]) return match[1];
		}
		return undefined;
	} catch {
		return undefined;
	}
}

function extractAmazonAsin(value: string) {
	try {
		const url = new URL(value);
		const hostname = url.hostname.replace(/^www\./, "");
		if (!hostname.endsWith("amazon.com")) return undefined;

		const segments = url.pathname.split("/").filter(Boolean);
		const asinSegmentKeys = ["dp", "product", "d", "asin"] as const;
		for (const key of asinSegmentKeys) {
			const index = segments.indexOf(key);
			const asin = index >= 0 ? segments[index + 1] : undefined;
			if (asin && isAmazonAsin(asin)) return asin.toUpperCase();
		}

		const kindleIndex = segments.indexOf("kindle-dbs");
		if (kindleIndex >= 0) {
			const productIndex = segments.indexOf("product");
			const asin = productIndex >= 0 ? segments[productIndex + 1] : undefined;
			if (asin && isAmazonAsin(asin)) return asin.toUpperCase();
		}

		return undefined;
	} catch {
		return undefined;
	}
}

function isAmazonAsin(value: string) {
	return /^[A-Z0-9]{10}$/i.test(value);
}

function isIsbn10(value: string) {
	const normalized = normalizeIsbn(value);
	if (!/^\d{9}[\dX]$/.test(normalized)) return false;

	let sum = 0;
	for (let index = 0; index < normalized.length; index += 1) {
		const char = normalized[index];
		const digit = char === "X" ? 10 : Number(char);
		sum += digit * (10 - index);
	}
	return sum % 11 === 0;
}

function extractTmdbId(value: string) {
	try {
		const url = new URL(value);
		const hostname = url.hostname.replace(/^www\./, "");
		if (hostname !== "themoviedb.org") return undefined;

		const segments = url.pathname.split("/").filter(Boolean);
		const kind = segments[0];
		const id = segments[1]?.match(/^\d+/)?.[0];
		if ((kind === "movie" || kind === "tv") && id) {
			return { type: kind, id };
		}
		return undefined;
	} catch {
		return undefined;
	}
}

function extractAnilistId(value: string) {
	try {
		const url = new URL(value);
		const hostname = url.hostname.replace(/^www\./, "");
		if (hostname !== "anilist.co") return undefined;

		const segments = url.pathname.split("/").filter(Boolean);
		const kind = segments[0];
		const id = segments[1];
		if ((kind === "anime" || kind === "manga") && /^\d+$/.test(id)) {
			return { type: kind, id };
		}
		return undefined;
	} catch {
		return undefined;
	}
}

function extractManhwaWebId(value: string) {
	const trimmed = value.trim();
	if (!trimmed) return undefined;

	try {
		const url = new URL(trimmed);
		if (!url.hostname.replace(/^www\./, "").includes("manhwaweb.com")) {
			return undefined;
		}
		const segments = url.pathname.split("/").filter(Boolean);
		const manhwaIndex = segments.findIndex(
			(segment) => segment === "manhwa" || segment === "manga",
		);
		const id = manhwaIndex >= 0 ? segments[manhwaIndex + 1] : undefined;
		return id ? decodeURIComponent(id) : undefined;
	} catch {
		if (/^[a-z0-9][a-z0-9._-]*_\d+$/i.test(trimmed)) return trimmed;
		return undefined;
	}
}

function extractMangaDexTitleId(value: string) {
	try {
		const url = new URL(value);
		if (url.hostname.replace(/^www\./, "") !== "mangadex.org") {
			return undefined;
		}

		const segments = url.pathname.split("/").filter(Boolean);
		const titleIndex = segments.indexOf("title");
		const id = titleIndex >= 0 ? segments[titleIndex + 1] : undefined;
		if (!id || !isUuid(id)) return undefined;
		return id;
	} catch {
		return undefined;
	}
}

function isUuid(value: string) {
	return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
		value,
	);
}

function getCubariManifestUrl(value: string) {
	try {
		const url = new URL(value);
		if (url.hostname.replace(/^www\./, "") !== "cubari.moe") {
			return undefined;
		}

		const segments = url.pathname.split("/").filter(Boolean);
		const gistIndex = segments.indexOf("gist");
		const encodedPath = gistIndex >= 0 ? segments[gistIndex + 1] : undefined;
		if (!encodedPath) return undefined;

		const decodedPath = decodeBase64Url(encodedPath);
		if (!decodedPath?.startsWith("raw/")) return undefined;

		const [, owner, repo, branch, ...pathParts] = decodedPath.split("/");
		if (!owner || !repo || !branch || !pathParts.length) return undefined;

		const path = pathParts
			.map((part) => encodeURIComponent(part).replace(/%25/g, "%"))
			.join("/");
		return `https://raw.githubusercontent.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${encodeURIComponent(branch)}/${path}`;
	} catch {
		return undefined;
	}
}

function decodeBase64Url(value: string) {
	const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
	const alphabet =
		"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
	const bytes: number[] = [];
	let buffer = 0;
	let bits = 0;

	for (const char of normalized.replace(/=+$/, "")) {
		const index = alphabet.indexOf(char);
		if (index < 0) return undefined;
		buffer = (buffer << 6) | index;
		bits += 6;
		if (bits >= 8) {
			bits -= 8;
			bytes.push((buffer >> bits) & 0xff);
		}
	}

	return String.fromCharCode(...bytes);
}

function getLatestCubariChapter(manifest: CubariManifest) {
	const chapterNumbers = Object.keys(manifest.chapters ?? {})
		.map((chapter) => parseChapterNumber(chapter))
		.filter((value): value is number => value !== undefined);
	if (!chapterNumbers.length) return undefined;
	return Math.max(...chapterNumbers);
}

function normalizeReadingUrl(value: string) {
	const trimmed = value.trim();
	if (!trimmed) return undefined;
	if (/^https?:\/\//i.test(trimmed)) return trimmed;
	return `https://${trimmed}`;
}

function manhwaWebItemToSearchResult(
	item: ManhwaWebSearchItem,
): MetadataSearchResult {
	return {
		source: "manhwaweb",
		id: item.real_id ?? item._id,
		title: item.the_real_name ?? item.name_esp ?? item._name ?? "Sin titulo",
		coverUrl: proxyManhwaWebImageUrl(item._imagen),
		status: mapManhwaWebStatus(item._status),
		latestChapter: nullableChapter(item._numero_cap),
		latestChapterSource: "scraping",
		latestChapterCheckedAt: Date.now(),
		canonicalUrl: `https://www.manhwaweb.com/manhwa/${item.real_id ?? item._id}`,
	};
}

export function proxyManhwaWebImageUrl(value?: string) {
	if (!value) return undefined;
	if (value.startsWith(MANHWA_WEB_IMAGE_PROXY_PATH)) return value;

	try {
		const url = new URL(value);
		if (!MANHWA_WEB_IMAGE_HOSTS.has(url.hostname)) return value;
		return `${MANHWA_WEB_IMAGE_PROXY_PATH}?url=${encodeURIComponent(url.toString())}`;
	} catch {
		return value;
	}
}

export function isAllowedManhwaWebImageUrl(value: string) {
	try {
		const url = new URL(value);
		return (
			(url.protocol === "https:" || url.protocol === "http:") &&
			MANHWA_WEB_IMAGE_HOSTS.has(url.hostname)
		);
	} catch {
		return false;
	}
}

function metadataDetailsToSearchResult(
	details: MetadataDetails,
): MetadataSearchResult {
	return {
		source: details.source,
		id: details.id,
		title: details.title ?? "Sin titulo",
		subtitle: details.subtitle,
		creator: details.creator,
		year: details.year,
		coverUrl: details.coverUrl,
		pages: details.pages,
		durationMinutes: details.durationMinutes,
		publisher: details.publisher,
		publishedDate: details.publishedDate,
		language: details.language,
		isbn10: details.isbn10,
		isbn13: details.isbn13,
		categories: details.categories,
		description: details.description,
		status: details.status,
		seasons: details.seasons,
		episodes: details.episodes,
		episodesAired: details.episodesAired,
		nextEpisodeDate: details.nextEpisodeDate,
		runtime: details.runtime,
		watchProviders: details.watchProviders,
		volumes: details.volumes,
		season: details.season,
		seasonYear: details.seasonYear,
		latestChapter: details.latestChapter,
		latestChapterSource: details.latestChapterSource,
		latestChapterCheckedAt: details.latestChapterCheckedAt,
		mangaPlusTitleId: details.mangaPlusTitleId,
		mangaDexId: details.mangaDexId,
		canonicalUrl: details.canonicalUrl,
	};
}

function isManhwaWebTypeMatch(value?: string, obraType?: ObraType) {
	if (!obraType || obraType !== "manhwa") return true;
	return value === "manhwa";
}

function mapManhwaWebStatus(value?: string) {
	switch (value?.toLowerCase()) {
		case "publicandose":
		case "publicándose":
			return "RELEASING";
		case "finalizado":
			return "FINISHED";
		case "hiatus":
			return "HIATUS";
		default:
			return value;
	}
}

function nullableChapter(value: unknown) {
	return typeof value === "number" && Number.isFinite(value)
		? value
		: undefined;
}

function getLatestManhwaWebChapter(chapters?: ManhwaWebChapter[]) {
	const numbers =
		chapters
			?.map((chapter) => nullableChapter(chapter.chapter))
			.filter((value): value is number => value !== undefined) ?? [];
	if (!numbers.length) return undefined;
	return Math.max(...numbers);
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

async function getAmazonBookDetails(id: string): Promise<MetadataDetails> {
	const directAsin = id.trim();
	const normalizedUrl = normalizeUrlCandidate(id);
	const asin = isAmazonAsin(directAsin)
		? directAsin
		: normalizedUrl
			? extractAmazonAsin(normalizedUrl)
			: undefined;
	if (!asin || !isAmazonAsin(asin)) {
		throw new Error("ASIN de Amazon invalido.");
	}

	const normalizedAsin = asin.toUpperCase();
	return getAmazonBookDetailsFromUrl(
		normalizedAsin,
		isAmazonAsin(directAsin)
			? `https://www.amazon.com/dp/${normalizedAsin}`
			: (normalizedUrl ?? `https://www.amazon.com/dp/${normalizedAsin}`),
	);
}

async function getAmazonBookDetailsFromUrl(
	asin: string,
	url: string,
): Promise<MetadataDetails> {
	const html = await fetchAmazonBookHtml(url);
	if (isAmazonBlockedHtml(html)) {
		throw new Error("Amazon bloqueo la consulta publica del producto.");
	}

	const canonicalUrl =
		extractAmazonCanonicalUrl(html) ?? `https://www.amazon.com/dp/${asin}`;
	const publishedDate = extractAmazonRpiAttribute(
		html,
		"book_details-publication_date",
	);
	const title = extractAmazonTitle(html);
	if (!title) {
		throw new Error("No se encontraron metadatos de libro en Amazon.");
	}

	return {
		source: "amazon",
		id: asin,
		title,
		creator: extractAmazonAuthors(html),
		year: parseYear(publishedDate),
		coverUrl: extractAmazonCoverUrl(html),
		pages: parseIntegerFromText(
			extractAmazonRpiAttribute(html, "book_details-ebook_pages") ??
				extractAmazonRpiAttribute(html, "book_details-print_length"),
		),
		publisher: extractAmazonRpiAttribute(html, "book_details-publisher"),
		publishedDate,
		language: extractAmazonRpiAttribute(html, "language"),
		isbn10: normalizeOptionalIsbn(
			extractAmazonRpiAttribute(html, "book_details-isbn_10"),
			10,
		),
		isbn13: normalizeOptionalIsbn(
			extractAmazonRpiAttribute(html, "book_details-isbn_13"),
			13,
		),
		description: extractAmazonDescription(html),
		canonicalUrl,
	};
}

async function fetchAmazonBookHtml(url: string) {
	const response = await fetch(url, {
		headers: {
			Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
			"Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
			"User-Agent":
				"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
		},
	});
	if (!response.ok) {
		throw new Error(`No se pudo consultar Amazon. (HTTP ${response.status})`);
	}

	return response.text();
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

function extractAmazonTitle(html: string) {
	return (
		extractElementTextById(html, "productTitle") ??
		cleanAmazonMetaTitle(
			extractMetaContent(html, "og:title") ??
				extractMetaContent(html, "title") ??
				extractDocumentTitle(html),
		)
	);
}

function extractAmazonAuthors(html: string) {
	const byline = extractHtmlSliceById(html, "bylineInfo", 8000);
	const authorMatches = byline
		? [
				...byline.matchAll(
					/class=["'][^"']*\bauthor\b[^"']*["'][\s\S]*?<a\b[^>]*>([\s\S]*?)<\/a>/gi,
				),
			]
		: [];
	const authors = authorMatches
		.map((match) => stripHtml(match[1]))
		.filter((value): value is string => Boolean(value));
	if (authors.length) return Array.from(new Set(authors)).join(", ");

	return extractAmazonAuthorsFromMetaTitle(
		extractMetaContent(html, "title") ?? extractDocumentTitle(html),
	);
}

function extractAmazonAuthorsFromMetaTitle(value?: string) {
	if (!value) return undefined;
	const match = value.match(/\beBook\s+:\s+(.+?)(?:\s*:\s*[^:]+)?$/i);
	const rawAuthors = match?.[1]
		?.replace(/\bAmazon\.[^:]+:\s*/i, "")
		.replace(/\bTienda Kindle\b.*$/i, "")
		.trim();
	if (!rawAuthors) return undefined;

	const parts = rawAuthors
		.split(/\s*,\s*/)
		.map((part) => part.trim())
		.filter(Boolean);
	if (parts.length >= 2 && parts.length % 2 === 0) {
		const names: string[] = [];
		for (let index = 0; index < parts.length; index += 2) {
			names.push(`${parts[index + 1]} ${parts[index]}`.trim());
		}
		return names.join(", ");
	}

	return rawAuthors;
}

function extractAmazonCoverUrl(html: string) {
	const imageTag =
		html.match(/<img\b[^>]*\bid=["']landingImage["'][^>]*>/i)?.[0] ??
		html.match(
			/<img\b[^>]*\bdata-a-image-name=["']landingImage["'][^>]*>/i,
		)?.[0];
	if (imageTag) {
		const oldHires = getHtmlAttribute(imageTag, "data-old-hires");
		if (oldHires) return oldHires;

		const src = getHtmlAttribute(imageTag, "src");
		if (src) return src;

		const dynamicImage = parseAmazonDynamicImage(
			getHtmlAttribute(imageTag, "data-a-dynamic-image"),
		);
		if (dynamicImage) return dynamicImage;
	}

	return extractMetaContent(html, "og:image");
}

function parseAmazonDynamicImage(value?: string) {
	if (!value) return undefined;
	try {
		const parsed = JSON.parse(decodeHtmlEntities(value)) as Record<
			string,
			unknown
		>;
		return Object.keys(parsed).find(Boolean);
	} catch {
		return undefined;
	}
}

function extractAmazonDescription(html: string) {
	const slice = extractHtmlSliceById(
		html,
		"bookDescription_feature_div",
		30000,
	);
	if (!slice) return undefined;

	const expanderContent = slice.match(
		/<div\b[^>]*class=["'][^"']*\ba-expander-content\b[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*<div\b[^>]*class=["'][^"']*\ba-expander-header\b/i,
	)?.[1];
	const noscriptContent = slice.match(/<noscript>([\s\S]*?)<\/noscript>/i)?.[1];
	const description = stripHtml(expanderContent ?? noscriptContent);
	if (!description) return undefined;

	return description.length > 5000
		? `${description.slice(0, 5000).trim()}...`
		: description;
}

function extractAmazonRpiAttribute(html: string, attributeName: string) {
	const markers = [
		`data-rpi-attribute-name="${attributeName}"`,
		`data-rpi-attribute-name='${attributeName}'`,
	];
	const index = markers
		.map((marker) => html.indexOf(marker))
		.filter((value) => value >= 0)
		.sort((a, b) => a - b)[0];
	if (index === undefined) return undefined;

	const slice = html.slice(index, index + 3000);
	const valueHtml = slice.match(
		/<div\b[^>]*class=["'][^"']*\brpi-attribute-value\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
	)?.[1];
	return stripHtml(valueHtml);
}

function extractAmazonCanonicalUrl(html: string) {
	const linkTags = html.match(/<link\b[^>]*>/gi) ?? [];
	for (const tag of linkTags) {
		const rel = getHtmlAttribute(tag, "rel");
		if (
			rel?.split(/\s+/).some((value) => value.toLowerCase() === "canonical")
		) {
			const href = getHtmlAttribute(tag, "href");
			if (href) return href;
		}
	}

	return undefined;
}

function extractMetaContent(html: string, key: string) {
	const metaTags = html.match(/<meta\b[^>]*>/gi) ?? [];
	for (const tag of metaTags) {
		const name = getHtmlAttribute(tag, "name");
		const property = getHtmlAttribute(tag, "property");
		if (name === key || property === key) {
			return cleanText(getHtmlAttribute(tag, "content"));
		}
	}

	return undefined;
}

function extractDocumentTitle(html: string) {
	return cleanText(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]);
}

function extractElementTextById(html: string, id: string) {
	const match = html.match(
		new RegExp(
			`<([a-z0-9]+)\\b[^>]*\\bid=["']${escapeRegExp(id)}["'][^>]*>([\\s\\S]*?)<\\/\\1>`,
			"i",
		),
	);
	return stripHtml(match?.[2]);
}

function extractHtmlSliceById(html: string, id: string, length: number) {
	const doubleQuoteIndex = html.indexOf(`id="${id}"`);
	const singleQuoteIndex = html.indexOf(`id='${id}'`);
	const indices = [doubleQuoteIndex, singleQuoteIndex]
		.filter((value) => value >= 0)
		.sort((a, b) => a - b);
	const index = indices[0];
	if (index === undefined) return undefined;
	return html.slice(Math.max(0, index - 500), index + length);
}

function getHtmlAttribute(tag: string, attribute: string) {
	const match = tag.match(
		new RegExp(`\\b${escapeRegExp(attribute)}=["']([^"']*)["']`, "i"),
	);
	return cleanText(match?.[1]);
}

function cleanAmazonMetaTitle(value?: string) {
	const title = cleanText(value)
		?.replace(/^Amazon\.[^:]+:\s*/i, "")
		.replace(/\s+:\s*(?:Tienda Kindle|Kindle Store).*$/i, "");
	if (!title) return undefined;
	return cleanText(title.split(/\s+eBook\s+:\s+/i)[0]);
}

function isAmazonBlockedHtml(html: string) {
	const normalized = html.toLowerCase();
	return (
		normalized.includes("robot check") ||
		normalized.includes("/errors/validatecaptcha") ||
		normalized.includes("enter the characters you see below") ||
		normalized.includes("automated access to amazon")
	);
}

function parseIntegerFromText(value?: string) {
	if (!value) return undefined;
	const match = value.match(/\d[\d.,]*/);
	if (!match?.[0]) return undefined;
	const parsed = Number(match[0].replace(/\D/g, ""));
	return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeOptionalIsbn(value: string | undefined, length: 10 | 13) {
	if (!value) return undefined;
	const normalized = normalizeIsbn(value);
	return normalized.length === length ? normalized : undefined;
}

function cleanText(value?: string) {
	if (!value) return undefined;
	const normalized = decodeHtmlEntities(value).replace(/\s+/g, " ").trim();
	return normalized || undefined;
}

function decodeHtmlEntities(value: string) {
	return value
		.replace(/&nbsp;/g, " ")
		.replace(/&amp;/g, "&")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&apos;/g, "'")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&ntilde;/g, "ñ")
		.replace(/&Ntilde;/g, "Ñ")
		.replace(/&aacute;/g, "á")
		.replace(/&eacute;/g, "é")
		.replace(/&iacute;/g, "í")
		.replace(/&oacute;/g, "ó")
		.replace(/&uacute;/g, "ú")
		.replace(/&Aacute;/g, "Á")
		.replace(/&Eacute;/g, "É")
		.replace(/&Iacute;/g, "Í")
		.replace(/&Oacute;/g, "Ó")
		.replace(/&Uacute;/g, "Ú")
		.replace(/&#(\d+);/g, (_, codepoint: string) =>
			String.fromCodePoint(Number(codepoint)),
		)
		.replace(/&#x([0-9a-f]+);/gi, (_, codepoint: string) =>
			String.fromCodePoint(Number.parseInt(codepoint, 16)),
		);
}

function escapeRegExp(value: string) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripHtml(value?: string) {
	if (!value) return undefined;
	return cleanText(value.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, ""));
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

interface ManhwaWebSearchResponse {
	data?: ManhwaWebSearchItem[];
}

interface ManhwaWebSearchItem {
	_id: string;
	real_id?: string;
	_name?: string;
	the_real_name?: string;
	name_esp?: string;
	_imagen?: string;
	_status?: string;
	_numero_cap?: number;
	_tipo?: string;
}

interface ManhwaWebDetails extends ManhwaWebSearchItem {
	_sinopsis?: string;
	numero_cap_esp?: number;
	_extras?: {
		autores?: string[];
	};
	chapters?: ManhwaWebChapter[];
}

interface ManhwaWebChapter {
	chapter?: number;
}

interface CubariManifest {
	title?: string;
	author?: string;
	artist?: string;
	cover?: string;
	chapters?: Record<string, unknown>;
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
