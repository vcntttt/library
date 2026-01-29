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

const providerLastRequest = new Map<MetadataSource, number>();

export const providerByType: Record<ObraType, MetadataSource> = {
	book: "google-books",
	movie: "tmdb",
	series: "tmdb",
	anime: "anilist",
	manga: "anilist",
};

export async function searchMetadata(
	provider: MetadataSource,
	query: string,
	obraType?: ObraType,
) {
	const trimmedQuery = query.trim();
	if (!trimmedQuery) return [];

	const cacheKey = `${provider}:${trimmedQuery.toLowerCase()}:${obraType ?? ""}`;
	const cached = providerCache.get(cacheKey);
	if (cached && cached.expiresAt > Date.now()) {
		return cached.value;
	}

	await enforceRateLimit(provider);
	let results: MetadataSearchResult[] = [];

	switch (provider) {
		case "google-books":
			results = await searchGoogleBooks(trimmedQuery);
			break;
		case "open-library":
			results = await searchOpenLibrary(trimmedQuery);
			break;
		case "tmdb":
			results = await searchTmdb(trimmedQuery, obraType);
			break;
		case "anilist":
			results = await searchAnilist(trimmedQuery, obraType);
			break;
	}

	providerCache.set(cacheKey, {
		expiresAt: Date.now() + CACHE_TTL_MS,
		value: results,
	});

	return results;
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

async function searchGoogleBooks(query: string) {
	const url = new URL("https://www.googleapis.com/books/v1/volumes");
	url.searchParams.set("q", query);
	url.searchParams.set("maxResults", "6");

	const apiKey = process.env.GOOGLE_BOOKS_API_KEY;
	if (apiKey) {
		url.searchParams.set("key", apiKey);
	}

	const data = await fetchJson<{ items?: GoogleBooksItem[] }>(url.toString());
	return (
		data.items?.map((item) => ({
			source: "google-books" as const,
			id: item.id,
			title: item.volumeInfo.title,
			creator: item.volumeInfo.authors?.join(", "),
			year: parseYear(item.volumeInfo.publishedDate),
			coverUrl: pickGoogleCover(item.volumeInfo.imageLinks),
			pages: item.volumeInfo.pageCount,
		})) ?? []
	);
}

async function searchOpenLibrary(query: string) {
	const url = new URL("https://openlibrary.org/search.json");
	url.searchParams.set("q", query);
	url.searchParams.set("limit", "6");

	const data = await fetchJson<OpenLibraryResponse>(url.toString());
	return (
		data.docs?.map((doc) => ({
			source: "open-library" as const,
			id: doc.key,
			title: doc.title,
			creator: doc.author_name?.join(", "),
			year: doc.first_publish_year,
			coverUrl: doc.cover_i
				? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`
				: undefined,
			pages: doc.number_of_pages_median,
		})) ?? []
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
	const mediaType = obraType === "manga" ? "MANGA" : "ANIME";
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
			chapters: media.chapters ?? undefined,
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
		creator: data.volumeInfo.authors?.join(", "),
		year: parseYear(data.volumeInfo.publishedDate),
		coverUrl: pickGoogleCover(data.volumeInfo.imageLinks),
		pages: data.volumeInfo.pageCount,
	};
}

async function getOpenLibraryDetails(id: string): Promise<MetadataDetails> {
	const normalized = id.startsWith("/") ? id : `/${id}`;
	const url = `https://openlibrary.org${normalized}.json`;
	const data = await fetchJson<OpenLibraryDetails>(url);

	return {
		source: "open-library",
		id,
		title: data.title,
		year: data.first_publish_date
			? parseYear(data.first_publish_date)
			: undefined,
		pages: data.number_of_pages ?? data.number_of_pages_median,
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

	return {
		source: "anilist",
		id: String(media.id),
		title:
			media.title.english ??
			media.title.romaji ??
			media.title.native ??
			undefined,
		creator: getAnilistCreator(media, obraType),
		coverUrl: media.coverImage?.extraLarge ?? media.coverImage?.large,
		season: media.season ?? undefined,
		seasonYear: media.seasonYear ?? undefined,
		status: media.status ?? undefined,
		episodes: media.episodes ?? undefined,
		chapters: media.chapters ?? undefined,
		volumes: media.volumes ?? undefined,
		episodesAired: nextEpisode?.episode
			? Math.max(nextEpisode.episode - 1, 0)
			: undefined,
		nextEpisodeDate: nextEpisode?.airingAt
			? nextEpisode.airingAt * 1000
			: undefined,
	};
}

export async function getMetadataDetails(
	source: MetadataSource,
	id: string,
	obraType?: ObraType,
) {
	const cacheKey = `${source}:${id}`;
	const cached = detailsCache.get(cacheKey);
	if (cached && cached.expiresAt > Date.now()) {
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
		const message = await getMetadataErrorMessage(response, url);
		throw new Error(message);
	}
	return (await response.json()) as T;
}

async function getMetadataErrorMessage(response: Response, url: string) {
	const fallback = "No se pudo consultar metadatos.";
	let detail: string | undefined;

	try {
		const text = await response.text();
		if (text) {
			const payload = JSON.parse(text) as {
				error?: { message?: string } | string;
			};
			if (payload?.error) {
				detail =
					typeof payload.error === "string"
						? payload.error
						: payload.error.message;
			}
		}
	} catch (error) {
		void error;
	}

	if (response.status === 403 && url.includes("googleapis.com/books")) {
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

function parseYear(value?: string) {
	if (!value) return undefined;
	const match = value.match(/\d{4}/);
	return match ? Number(match[0]) : undefined;
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
		authors?: string[];
		publishedDate?: string;
		pageCount?: number;
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
	}>;
}

interface OpenLibraryDetails {
	title?: string;
	first_publish_date?: string;
	number_of_pages?: number;
	number_of_pages_median?: number;
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
  }
}
`;
