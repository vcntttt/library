import { mutation, query } from './_generated/server'
import { v } from 'convex/values'

const obraType = v.union(
  v.literal('book'),
  v.literal('movie'),
  v.literal('series'),
  v.literal('anime'),
  v.literal('manga'),
)

const obraStatus = v.union(
  v.literal('backlog'),
  v.literal('in-progress'),
  v.literal('finished'),
  v.literal('dropped'),
)

type MetadataInput = {
  pages?: number | null
  seasons?: number | null
  episodes?: number | null
  episodesAired?: number | null
  nextEpisodeDate?: number | null
  status?: string | null
  chapters?: number | null
  volumes?: number | null
  season?: string | null
  seasonYear?: number | null
  runtime?: number | null
  watchProviders?: Array<string | null> | null
  latestChapter?: number | null
  latestChapterSource?: string | null
  latestChapterCheckedAt?: number | null
  lastNotifiedChapter?: number | null
  mangaPlusTitleId?: string | null
  mangaDexId?: string | null
} | null

const sanitizeMetadata = (metadata?: MetadataInput) => {
  if (!metadata) return undefined

  return {
    pages: metadata.pages ?? undefined,
    seasons: metadata.seasons ?? undefined,
    episodes: metadata.episodes ?? undefined,
    episodesAired: metadata.episodesAired ?? undefined,
    nextEpisodeDate: metadata.nextEpisodeDate ?? undefined,
    status: metadata.status ?? undefined,
    chapters: metadata.chapters ?? undefined,
    volumes: metadata.volumes ?? undefined,
    season: metadata.season ?? undefined,
    seasonYear: metadata.seasonYear ?? undefined,
    runtime: metadata.runtime ?? undefined,
    watchProviders: metadata.watchProviders
      ? metadata.watchProviders
          .map((provider) => provider?.trim())
          .filter((provider): provider is string => Boolean(provider))
      : undefined,
    latestChapter: metadata.latestChapter ?? undefined,
    latestChapterSource: metadata.latestChapterSource ?? undefined,
    latestChapterCheckedAt: metadata.latestChapterCheckedAt ?? undefined,
    lastNotifiedChapter: metadata.lastNotifiedChapter ?? undefined,
    mangaPlusTitleId: metadata.mangaPlusTitleId?.trim() || undefined,
    mangaDexId: metadata.mangaDexId?.trim() || undefined,
  }
}

export const list = query({
  args: {
    status: v.optional(obraStatus),
    type: v.optional(obraType),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error('Unauthenticated')
    }

    const userTokenIdentifier = identity.tokenIdentifier
    const limit = args.limit ?? 200

    if (args.status) {
      return await ctx.db
        .query('obras')
        .withIndex('by_user_status_updatedAt', (q) =>
          q
            .eq('userTokenIdentifier', userTokenIdentifier)
            .eq('status', args.status!),
        )
        .order('desc')
        .take(limit)
    }

    if (args.type) {
      return await ctx.db
        .query('obras')
        .withIndex('by_user_type_updatedAt', (q) =>
          q.eq('userTokenIdentifier', userTokenIdentifier).eq('type', args.type!),
        )
        .order('desc')
        .take(limit)
    }

    return await ctx.db
      .query('obras')
      .withIndex('by_user_updatedAt', (q) =>
        q.eq('userTokenIdentifier', userTokenIdentifier),
      )
      .order('desc')
      .take(limit)
  },
})

export const get = query({
  args: { id: v.id('obras') },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error('Unauthenticated')
    }

    const doc = await ctx.db.get(args.id)
    if (!doc) {
      return null
    }

    if (doc.userTokenIdentifier !== identity.tokenIdentifier) {
      return null
    }

    return doc
  },
})

export const create = mutation({
  args: {
    title: v.string(),
    type: obraType,
    status: obraStatus,
    review: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    notes: v.optional(v.string()),
    obsidianPath: v.optional(v.string()),
    readingUrl: v.optional(v.string()),
    external: v.optional(
      v.object({
        source: v.string(),
        id: v.string(),
      }),
    ),
    metadata: v.optional(
      v.object({
        pages: v.optional(v.number()),
        seasons: v.optional(v.number()),
        episodes: v.optional(v.number()),
        episodesAired: v.optional(v.number()),
        nextEpisodeDate: v.optional(v.number()),
        status: v.optional(v.string()),
        chapters: v.optional(v.number()),
        volumes: v.optional(v.number()),
        season: v.optional(v.string()),
        seasonYear: v.optional(v.number()),
        runtime: v.optional(v.number()),
        watchProviders: v.optional(v.array(v.string())),
        latestChapter: v.optional(v.number()),
        latestChapterSource: v.optional(v.string()),
        latestChapterCheckedAt: v.optional(v.number()),
        lastNotifiedChapter: v.optional(v.number()),
        mangaPlusTitleId: v.optional(v.string()),
        mangaDexId: v.optional(v.string()),
      }),
    ),
    coverUrl: v.optional(v.string()),
    creator: v.optional(v.string()),
    year: v.optional(v.number()),
    progress: v.optional(
      v.object({
        current: v.number(),
        total: v.number(),
      }),
    ),
    startedAt: v.optional(v.number()),
    finishedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error('Unauthenticated')
    }

    const now = Date.now()

    if (args.progress) {
      if (args.progress.total <= 0 || args.progress.current < 0) {
        throw new Error('Progreso invalido')
      }
      if (args.progress.current > args.progress.total) {
        throw new Error('El progreso no puede superar el total')
      }
    }

    if (args.external) {
      const source = args.external.source.trim()
      const id = args.external.id.trim()
      if (!source || !id) {
        throw new Error('Metadata invalida')
      }
    }

    const metadata = sanitizeMetadata(args.metadata as MetadataInput)

    let startedAt = args.startedAt
    let finishedAt = args.finishedAt

    if (args.status === 'in-progress' && startedAt === undefined) {
      startedAt = now
    }

    if (args.status === 'finished') {
      if (startedAt === undefined) {
        startedAt = now
      }
      if (finishedAt === undefined) {
        finishedAt = now
      }
    }

    return await ctx.db.insert('obras', {
      userTokenIdentifier: identity.tokenIdentifier,
      title: args.title.trim(),
      type: args.type,
      status: args.status,
      review: args.review?.trim() || undefined,
      tags:
        args.tags
          ?.map((t) => t.trim().toLowerCase())
          .filter(Boolean)
          .slice(0, 20) ?? [],
      notes: args.notes?.trim() || undefined,
      obsidianPath: args.obsidianPath?.trim() || undefined,
      readingUrl: args.readingUrl?.trim() || undefined,
      external: args.external
        ? {
            source: args.external.source.trim(),
            id: args.external.id.trim(),
          }
        : undefined,
      metadata,
      coverUrl: args.coverUrl?.trim() || undefined,
      creator: args.creator?.trim() || undefined,
      year: args.year,
      progress: args.progress,
      startedAt,
      finishedAt,
      createdAt: now,
      updatedAt: now,
    })
  },
})

export const update = mutation({
  args: {
    id: v.id('obras'),
    patch: v.object({
      title: v.optional(v.string()),
      type: v.optional(obraType),
      status: v.optional(obraStatus),
      review: v.optional(v.string()),
      tags: v.optional(v.array(v.string())),
      notes: v.optional(v.string()),
      obsidianPath: v.optional(v.string()),
      readingUrl: v.optional(v.string()),
      external: v.optional(
        v.object({
          source: v.string(),
          id: v.string(),
        }),
      ),
      metadata: v.optional(
        v.object({
          pages: v.optional(v.number()),
          seasons: v.optional(v.number()),
          episodes: v.optional(v.number()),
          episodesAired: v.optional(v.number()),
          nextEpisodeDate: v.optional(v.number()),
          status: v.optional(v.string()),
          chapters: v.optional(v.number()),
          volumes: v.optional(v.number()),
          season: v.optional(v.string()),
          seasonYear: v.optional(v.number()),
          runtime: v.optional(v.number()),
          watchProviders: v.optional(v.array(v.string())),
          latestChapter: v.optional(v.number()),
          latestChapterSource: v.optional(v.string()),
          latestChapterCheckedAt: v.optional(v.number()),
          lastNotifiedChapter: v.optional(v.number()),
          mangaPlusTitleId: v.optional(v.string()),
          mangaDexId: v.optional(v.string()),
        }),
      ),
      coverUrl: v.optional(v.string()),
      creator: v.optional(v.string()),
      year: v.optional(v.number()),
      progress: v.optional(
        v.object({
          current: v.number(),
          total: v.number(),
        }),
      ),
      startedAt: v.optional(v.number()),
      finishedAt: v.optional(v.number()),
    }),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error('Unauthenticated')
    }

    const existing = await ctx.db.get(args.id)
    if (!existing) {
      throw new Error('Obra no encontrada')
    }

    if (existing.userTokenIdentifier !== identity.tokenIdentifier) {
      throw new Error('Obra no encontrada')
    }

    const patch: Record<string, any> = { ...args.patch }

    if (patch.title !== undefined) patch.title = patch.title.trim()
    if (patch.review !== undefined)
      patch.review = patch.review?.trim() || undefined
    if (patch.notes !== undefined) patch.notes = patch.notes?.trim() || undefined
    if (patch.obsidianPath !== undefined)
      patch.obsidianPath = patch.obsidianPath?.trim() || undefined
    if (patch.readingUrl !== undefined)
      patch.readingUrl = patch.readingUrl?.trim() || undefined
    if (patch.external !== undefined) {
      const source = patch.external?.source?.trim()
      const id = patch.external?.id?.trim()
      if (!source || !id) {
        throw new Error('Metadata invalida')
      }
      patch.external = { source, id }
    }
    if (patch.metadata !== undefined) {
      patch.metadata = sanitizeMetadata(patch.metadata as MetadataInput)
    }
    if (patch.coverUrl !== undefined)
      patch.coverUrl = patch.coverUrl?.trim() || undefined
    if (patch.creator !== undefined)
      patch.creator = patch.creator?.trim() || undefined
    if (patch.tags !== undefined) {
      patch.tags = patch.tags
        .map((t: string) => t.trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 20)
    }

    if (patch.progress !== undefined && patch.progress !== null) {
      if (patch.progress.total <= 0 || patch.progress.current < 0) {
        throw new Error('Progreso invalido')
      }
      if (patch.progress.current > patch.progress.total) {
        throw new Error('El progreso no puede superar el total')
      }
    }

    if (patch.status && patch.status !== existing.status) {
      if (
        patch.status === 'in-progress' &&
        existing.startedAt === undefined &&
        patch.startedAt === undefined
      ) {
        patch.startedAt = Date.now()
      }

      if (
        patch.status === 'finished' &&
        existing.finishedAt === undefined &&
        patch.finishedAt === undefined
      ) {
        patch.finishedAt = Date.now()
      }

      if (
        existing.status === 'finished' &&
        patch.status !== 'finished' &&
        patch.finishedAt === undefined
      ) {
        patch.finishedAt = undefined
      }
    }

    patch.updatedAt = Date.now()

    return await ctx.db.patch(args.id, patch)
  },
})

export const remove = mutation({
  args: { id: v.id('obras') },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error('Unauthenticated')
    }

    const existing = await ctx.db.get(args.id)
    if (!existing) {
      throw new Error('Obra no encontrada')
    }

    if (existing.userTokenIdentifier !== identity.tokenIdentifier) {
      throw new Error('Obra no encontrada')
    }

    return await ctx.db.delete(args.id)
  },
})
