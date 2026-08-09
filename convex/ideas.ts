import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { scheduleReview } from "./lib/fsrs";
import { requireIntegrationOwner } from "../src/lib/reading/integration-owner";
import { ideaInputValidator, ideaRatingValidator } from "./lib/validators";

export const list = query({
	args: {},
	handler: async (ctx) => {
		const userId = await requireUserId(ctx);
		const rows = await ctx.db
			.query("ideas")
			.withIndex("by_user_updatedAt", (q) => q.eq("userId", userId))
			.order("desc")
			.collect();

		return rows.map(({ userId: _userId, ...idea }) => idea);
	},
});

export const listDue = query({
	args: { limit: v.optional(v.number()) },
	handler: async (ctx, { limit = 20 }) => {
		const userId = await requireUserId(ctx);
		const rows = await ctx.db
			.query("ideas")
			.withIndex("by_user_reviewDueAt", (q) =>
				q.eq("userId", userId).lte("reviewDueAt", Date.now()),
			)
			.order("asc")
			.take(Math.min(Math.max(limit, 1), 100));

		return rows.map(({ userId: _userId, ...idea }) => idea);
	},
});

export const get = query({
	args: { relativePath: v.string() },
	handler: async (ctx, { relativePath }) => {
		const userId = await requireUserId(ctx);
		const idea = await ctx.db
			.query("ideas")
			.withIndex("by_user_path", (q) =>
				q.eq("userId", userId).eq("relativePath", relativePath),
			)
			.unique();
		if (!idea) return null;
		const { userId: _userId, ...result } = idea;
		return result;
	},
});

export const upsert = mutation({
	args: { idea: ideaInputValidator },
	handler: async (ctx, { idea: input }) => {
		const userId = await requireUserId(ctx);
		const now = Date.now();
		const existing = await ctx.db
			.query("ideas")
			.withIndex("by_user_path", (q) =>
				q.eq("userId", userId).eq("relativePath", input.relativePath),
			)
			.unique();

		if (existing) {
			await ctx.db.patch(existing._id, {
				title: input.title,
				contentHash: input.contentHash,
				fileModifiedAt: input.fileModifiedAt,
				reviewDueAt: existing.reviewDueAt ?? now,
				reviewLogs: existing.reviewLogs ?? [],
				updatedAt: now,
			});
			return existing._id;
		}

		return ctx.db.insert("ideas", {
			userId,
			relativePath: input.relativePath,
			title: input.title,
			contentHash: input.contentHash,
			fileModifiedAt: input.fileModifiedAt,
			reviewDueAt: now,
			reviewLogs: [],
			createdAt: now,
			updatedAt: now,
		});
	},
});

export const review = mutation({
	args: {
		relativePath: v.string(),
		rating: ideaRatingValidator,
	},
	handler: async (ctx, { relativePath, rating }) => {
		const userId = await requireUserId(ctx);
		const idea = await ctx.db
			.query("ideas")
			.withIndex("by_user_path", (q) =>
				q.eq("userId", userId).eq("relativePath", relativePath),
			)
			.unique();
		if (!idea) throw new Error("Idea no encontrada.");

		const now = Date.now();
		const next = scheduleReview(idea.reviewCard, rating, now);
		await ctx.db.patch(idea._id, {
			reviewCard: next.card,
			reviewDueAt: next.card.due,
			reviewedAt: now,
			reviewLogs: [...(idea.reviewLogs ?? []), next.log].slice(-500),
			updatedAt: now,
		});
		return idea._id;
	},
});

async function requireUserId(ctx: Parameters<typeof requireIntegrationOwner>[0]) {
	return requireIntegrationOwner(ctx);
}
