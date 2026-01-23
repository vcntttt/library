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
    rating: v.optional(v.number()),
    review: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    notes: v.optional(v.string()),
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

    if (args.rating !== undefined && (args.rating < 1 || args.rating > 5)) {
      throw new Error('La valoracion debe estar entre 1 y 5')
    }

    return await ctx.db.insert('obras', {
      userTokenIdentifier: identity.tokenIdentifier,
      title: args.title.trim(),
      type: args.type,
      status: args.status,
      rating: args.rating,
      review: args.review?.trim() || undefined,
      tags:
        args.tags
          ?.map((t) => t.trim().toLowerCase())
          .filter(Boolean)
          .slice(0, 20) ?? [],
      notes: args.notes?.trim() || undefined,
      coverUrl: args.coverUrl?.trim() || undefined,
      creator: args.creator?.trim() || undefined,
      year: args.year,
      progress: args.progress,
      startedAt: args.startedAt,
      finishedAt: args.finishedAt,
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
      rating: v.optional(v.number()),
      review: v.optional(v.string()),
      tags: v.optional(v.array(v.string())),
      notes: v.optional(v.string()),
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

    if (
      patch.rating !== undefined &&
      (patch.rating < 1 || patch.rating > 5)
    ) {
      throw new Error('La valoracion debe estar entre 1 y 5')
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
