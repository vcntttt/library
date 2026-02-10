import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  obras: defineTable({
    userTokenIdentifier: v.string(),
    title: v.string(),
    type: v.union(
      v.literal('book'),
      v.literal('movie'),
      v.literal('series'),
      v.literal('anime'),
      v.literal('manga'),
    ),
    status: v.union(
      v.literal('backlog'),
      v.literal('in-progress'),
      v.literal('finished'),
      v.literal('dropped'),
    ),
    review: v.optional(v.string()),
    tags: v.array(v.string()),
    notes: v.optional(v.string()),
    obsidianPath: v.optional(v.string()),
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
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_user_updatedAt', ['userTokenIdentifier', 'updatedAt'])
    .index('by_user_status_updatedAt', ['userTokenIdentifier', 'status', 'updatedAt'])
    .index('by_user_type_updatedAt', ['userTokenIdentifier', 'type', 'updatedAt']),
})
