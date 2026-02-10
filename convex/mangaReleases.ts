import { internal } from './_generated/api'
import { internalAction, internalMutation, internalQuery } from './_generated/server'
import type { Doc } from './_generated/dataModel'
import { v } from 'convex/values'

type MangaChapterSource = 'manga-plus' | 'mangadex' | 'anilist'

interface ChapterResolution {
  latestChapter?: number
  latestChapterSource?: MangaChapterSource
  mangaPlusTitleId?: string
  mangaDexId?: string
}

interface AniListMangaSnapshot {
  anilistId: string
  title: string
  siteUrl?: string
  status?: string
  chapters?: number
  volumes?: number
  latestChapter?: number
  latestChapterSource?: MangaChapterSource
  latestChapterCheckedAt: number
  mangaPlusTitleId?: string
  mangaDexId?: string
}

export const listTrackedManga = internalQuery({
  args: {},
  handler: async (ctx) => {
    const obras = await ctx.db.query('obras').collect()
    return obras.filter(
      (obra) =>
        obra.type === 'manga' &&
        obra.external?.source === 'anilist' &&
        obra.external.id &&
        obra.status !== 'dropped',
    )
  },
})

export const saveMangaSnapshot = internalMutation({
  args: {
    id: v.id('obras'),
    chapters: v.optional(v.number()),
    volumes: v.optional(v.number()),
    publicationStatus: v.optional(v.string()),
    latestChapter: v.optional(v.number()),
    latestChapterSource: v.optional(v.string()),
    latestChapterCheckedAt: v.number(),
    mangaPlusTitleId: v.optional(v.string()),
    mangaDexId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id)
    if (!existing || existing.type !== 'manga') return

    const metadata = {
      ...(existing.metadata ?? {}),
      chapters: args.chapters ?? existing.metadata?.chapters,
      volumes: args.volumes ?? existing.metadata?.volumes,
      status: args.publicationStatus ?? existing.metadata?.status,
      latestChapter: args.latestChapter ?? existing.metadata?.latestChapter,
      latestChapterSource:
        args.latestChapterSource ?? existing.metadata?.latestChapterSource,
      latestChapterCheckedAt: args.latestChapterCheckedAt,
      mangaPlusTitleId: args.mangaPlusTitleId ?? existing.metadata?.mangaPlusTitleId,
      mangaDexId: args.mangaDexId ?? existing.metadata?.mangaDexId,
      lastNotifiedChapter: existing.metadata?.lastNotifiedChapter,
    }

    if (
      args.latestChapter !== undefined &&
      (metadata.chapters === undefined || args.latestChapter > metadata.chapters)
    ) {
      metadata.chapters = args.latestChapter
    }

    await ctx.db.patch(args.id, {
      metadata: compactMetadata(metadata),
      updatedAt: Date.now(),
    })
  },
})

export const markChapterNotified = internalMutation({
  args: {
    id: v.id('obras'),
    chapter: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.get(args.id)
    if (!existing || existing.type !== 'manga') return

    const metadata = {
      ...(existing.metadata ?? {}),
      lastNotifiedChapter: args.chapter,
      latestChapter:
        existing.metadata?.latestChapter !== undefined
          ? Math.max(existing.metadata.latestChapter, args.chapter)
          : args.chapter,
      latestChapterCheckedAt:
        existing.metadata?.latestChapterCheckedAt ?? Date.now(),
    }

    await ctx.db.patch(args.id, {
      metadata: compactMetadata(metadata),
      updatedAt: Date.now(),
    })
  },
})

export const checkForNewChapters = internalAction({
  args: {},
  handler: async (ctx) => {
    const tracked = await ctx.runQuery(internal.mangaReleases.listTrackedManga, {})
    const discordToken = process.env.DISCORD_BOT_TOKEN
    const discordChannelId = process.env.DISCORD_CHANNEL_ID
    const notificationsEnabled = Boolean(discordToken && discordChannelId)

    let checked = 0
    let updated = 0
    let notified = 0

    for (const manga of tracked) {
      checked += 1
      const externalId = manga.external?.id
      if (!externalId) continue

      const snapshot = await fetchAniListMangaSnapshot(externalId)
      if (!snapshot) continue

      await ctx.runMutation(internal.mangaReleases.saveMangaSnapshot, {
        id: manga._id,
        chapters: snapshot.chapters,
        volumes: snapshot.volumes,
        publicationStatus: snapshot.status,
        latestChapter: snapshot.latestChapter,
        latestChapterSource: snapshot.latestChapterSource,
        latestChapterCheckedAt: snapshot.latestChapterCheckedAt,
        mangaPlusTitleId: snapshot.mangaPlusTitleId,
        mangaDexId: snapshot.mangaDexId,
      })
      updated += 1

      if (!notificationsEnabled) continue
      if (snapshot.status !== 'RELEASING') continue

      const currentChapter = snapshot.latestChapter
      if (currentChapter === undefined) continue

      const lastNotified = manga.metadata?.lastNotifiedChapter ?? 0
      if (currentChapter <= lastNotified) continue

      const message = buildDiscordMessage(manga, snapshot)
      const sent = await sendDiscordMessage(discordToken!, discordChannelId!, message)
      if (!sent) continue

      await ctx.runMutation(internal.mangaReleases.markChapterNotified, {
        id: manga._id,
        chapter: currentChapter,
      })
      notified += 1
    }

    return {
      checked,
      updated,
      notified,
      notificationsEnabled,
    }
  },
})

function compactMetadata(metadata: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(metadata).filter(([, value]) => value !== undefined),
  )
}

function buildDiscordMessage(obra: Doc<'obras'>, snapshot: AniListMangaSnapshot) {
  const chapterLabel = Number.isInteger(snapshot.latestChapter)
    ? String(snapshot.latestChapter)
    : String(snapshot.latestChapter ?? '')
  const sourceLabel =
    snapshot.latestChapterSource === 'manga-plus'
      ? 'MANGA Plus'
      : snapshot.latestChapterSource === 'mangadex'
        ? 'MangaDex'
        : 'AniList'
  const preferredUrl = snapshot.mangaPlusTitleId
    ? `https://mangaplus.shueisha.co.jp/titles/${snapshot.mangaPlusTitleId}`
    : snapshot.siteUrl

  return [
    '📚 **Nuevo capítulo detectado**',
    `**${obra.title || snapshot.title}** · capítulo **${chapterLabel}**`,
    `Fuente: ${sourceLabel}`,
    preferredUrl,
  ]
    .filter(Boolean)
    .join('\n')
}

async function sendDiscordMessage(token: string, channelId: string, content: string) {
  try {
    const response = await fetch(
      `https://discord.com/api/v10/channels/${encodeURIComponent(channelId)}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bot ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content }),
      },
    )

    if (!response.ok) {
      const payload = await response.text().catch(() => '')
      console.error('[mangaReleases] discord send failed', {
        status: response.status,
        payload,
      })
      return false
    }

    return true
  } catch (error) {
    console.error('[mangaReleases] discord send error', {
      error: error instanceof Error ? error.message : String(error),
    })
    return false
  }
}

async function fetchAniListMangaSnapshot(anilistId: string) {
  try {
    const response = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: ANILIST_MANGA_QUERY,
        variables: { id: Number(anilistId) },
      }),
    })
    if (!response.ok) return undefined

    const payload = (await response.json()) as AniListGraphqlResponse
    const media = payload?.data?.Media
    if (!media) return undefined

    const chapterResolution = await resolveLatestChapter(media)
    const latestChapter =
      media.chapters !== undefined && chapterResolution.latestChapter !== undefined
        ? Math.max(media.chapters, chapterResolution.latestChapter)
        : media.chapters ?? chapterResolution.latestChapter
    const latestChapterSource =
      latestChapter === media.chapters && chapterResolution.latestChapter === undefined
        ? ('anilist' as const)
        : chapterResolution.latestChapterSource

    return {
      anilistId: String(media.id),
      title:
        media.title.english ??
        media.title.romaji ??
        media.title.native ??
        `Manga ${media.id}`,
      siteUrl: media.siteUrl ?? undefined,
      status: media.status ?? undefined,
      chapters: latestChapter,
      volumes: media.volumes ?? undefined,
      latestChapter,
      latestChapterSource,
      latestChapterCheckedAt: Date.now(),
      mangaPlusTitleId: chapterResolution.mangaPlusTitleId,
      mangaDexId: chapterResolution.mangaDexId,
    } satisfies AniListMangaSnapshot
  } catch (error) {
    console.error('[mangaReleases] anilist fetch error', {
      anilistId,
      error: error instanceof Error ? error.message : String(error),
    })
    return undefined
  }
}

async function resolveLatestChapter(media: AniListMedia) {
  const mangaPlusTitleId = extractMangaPlusTitleId(media.externalLinks)

  if (mangaPlusTitleId) {
    const mangaPlusChapter = await getMangaPlusLatestChapter(mangaPlusTitleId)
    if (mangaPlusChapter !== undefined) {
      return {
        latestChapter: mangaPlusChapter,
        latestChapterSource: 'manga-plus' as const,
        mangaPlusTitleId,
      } satisfies ChapterResolution
    }
  }

  const mangaDexResult = await resolveMangaDexLatestChapter(media)
  if (mangaDexResult.latestChapter !== undefined) {
    return {
      latestChapter: mangaDexResult.latestChapter,
      latestChapterSource: 'mangadex' as const,
      mangaPlusTitleId,
      mangaDexId: mangaDexResult.mangaDexId,
    } satisfies ChapterResolution
  }

  return {
    mangaPlusTitleId,
    mangaDexId: mangaDexResult.mangaDexId,
  } satisfies ChapterResolution
}

function extractMangaPlusTitleId(externalLinks?: Array<{ site?: string; url?: string }>) {
  if (!externalLinks?.length) return undefined

  for (const link of externalLinks) {
    if (!link?.url) continue
    if (!link.site?.toLowerCase().includes('manga plus')) continue
    const match = link.url.match(/\/titles\/(\d+)/i)
    if (match?.[1]) return match[1]
  }

  return undefined
}

async function getMangaPlusLatestChapter(titleId: string) {
  try {
    const response = await fetch(
      `https://jumpg-webapi.tokyo-cdn.com/api/title_detailV3?title_id=${encodeURIComponent(titleId)}&format=json`,
    )
    if (!response.ok) return undefined

    const payload = (await response.json()) as MangaPlusTitleDetailResponse
    const groups = payload?.success?.titleDetailView?.chapterListGroup ?? []
    const chapters = groups.flatMap((group) => [
      ...(group.firstChapterList ?? []),
      ...(group.midChapterList ?? []),
      ...(group.lastChapterList ?? []),
    ])
    const chapterNumbers = chapters
      .map((chapter) =>
        parseChapterNumber(chapter.name) ?? parseChapterNumber(chapter.subTitle),
      )
      .filter((value): value is number => value !== undefined)

    if (!chapterNumbers.length) return undefined
    return Math.max(...chapterNumbers)
  } catch (error) {
    void error
    return undefined
  }
}

async function resolveMangaDexLatestChapter(media: AniListMedia) {
  const primaryTitle = media.title.english ?? media.title.romaji ?? media.title.native
  if (!primaryTitle) {
    return {} as ChapterResolution
  }

  try {
    const searchUrl = new URL('https://api.mangadex.org/manga')
    searchUrl.searchParams.set('title', primaryTitle)
    searchUrl.searchParams.set('limit', '20')

    const response = await fetch(searchUrl.toString())
    if (!response.ok) {
      return {} as ChapterResolution
    }

    const payload = (await response.json()) as MangaDexSearchResponse
    const selected = pickMangaDexCandidate(payload.data ?? [], media)
    if (!selected) {
      return {} as ChapterResolution
    }

    const latestChapter =
      parseChapterNumber(selected.attributes?.lastChapter) ??
      (await getMangaDexLatestFromChapterFeed(selected.id))

    return {
      latestChapter,
      mangaDexId: selected.id,
    } satisfies ChapterResolution
  } catch (error) {
    void error
    return {} as ChapterResolution
  }
}

function pickMangaDexCandidate(candidates: MangaDexManga[], media: AniListMedia) {
  if (!candidates.length) return undefined

  const anilistId = String(media.id)
  const malId = media.idMal ? String(media.idMal) : undefined

  const byAnilistLink = candidates.find(
    (candidate) => candidate.attributes?.links?.al === anilistId,
  )
  if (byAnilistLink) return byAnilistLink

  if (malId) {
    const byMalLink = candidates.find(
      (candidate) => candidate.attributes?.links?.mal === malId,
    )
    if (byMalLink) return byMalLink
  }

  const normalizedTarget = normalizeTitle(
    media.title.english ?? media.title.romaji ?? media.title.native,
  )
  if (!normalizedTarget) return undefined

  return candidates.find((candidate) => {
    const titles = [
      ...Object.values(candidate.attributes?.title ?? {}),
      ...(candidate.attributes?.altTitles ?? []).flatMap((entry) =>
        Object.values(entry),
      ),
    ]
    return titles.some((title) => normalizeTitle(title) === normalizedTarget)
  })
}

function normalizeTitle(value?: string) {
  if (!value) return ''
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '').trim()
}

async function getMangaDexLatestFromChapterFeed(mangaId: string) {
  const url = new URL('https://api.mangadex.org/chapter')
  url.searchParams.set('manga', mangaId)
  url.searchParams.set('limit', '10')
  url.searchParams.set('order[readableAt]', 'desc')

  try {
    const response = await fetch(url.toString())
    if (!response.ok) return undefined
    const payload = (await response.json()) as MangaDexChapterResponse
    const chapterNumbers = (payload.data ?? [])
      .map((chapter) => parseChapterNumber(chapter.attributes?.chapter))
      .filter((value): value is number => value !== undefined)

    if (!chapterNumbers.length) return undefined
    return Math.max(...chapterNumbers)
  } catch (error) {
    void error
    return undefined
  }
}

function parseChapterNumber(value?: string | null) {
  if (!value) return undefined
  const match = value.match(/(\d+(?:\.\d+)?)/)
  if (!match?.[1]) return undefined
  const parsed = Number(match[1])
  return Number.isFinite(parsed) ? parsed : undefined
}

interface AniListGraphqlResponse {
  data?: {
    Media?: AniListMedia
  }
}

interface AniListMedia {
  id: number
  idMal?: number
  title: {
    romaji?: string
    english?: string
    native?: string
  }
  status?: string
  chapters?: number
  volumes?: number
  siteUrl?: string
  externalLinks?: Array<{
    site?: string
    url?: string
  }>
}

interface MangaPlusTitleDetailResponse {
  success?: {
    titleDetailView?: {
      chapterListGroup?: Array<{
        firstChapterList?: MangaPlusChapter[]
        midChapterList?: MangaPlusChapter[]
        lastChapterList?: MangaPlusChapter[]
      }>
    }
  }
}

interface MangaPlusChapter {
  name?: string
  subTitle?: string
}

interface MangaDexSearchResponse {
  data?: MangaDexManga[]
}

interface MangaDexManga {
  id: string
  attributes?: {
    title?: Record<string, string>
    altTitles?: Array<Record<string, string>>
    lastChapter?: string | null
    links?: {
      al?: string
      mal?: string
    }
  }
}

interface MangaDexChapterResponse {
  data?: Array<{
    attributes?: {
      chapter?: string | null
    }
  }>
}

const ANILIST_MANGA_QUERY = `
query ($id: Int) {
  Media(id: $id, type: MANGA) {
    id
    idMal
    title {
      romaji
      english
      native
    }
    status
    chapters
    volumes
    siteUrl
    externalLinks {
      site
      url
    }
  }
}
`
