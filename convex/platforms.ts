import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const MAX_PROVIDERS = 30;
const MAX_PROVIDER_LENGTH = 80;

export const getPreferences = query({
	args: {},
	returns: v.object({
		providers: v.array(v.string()),
		stremioEnabled: v.boolean(),
	}),
	handler: async (ctx) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new Error("Debes iniciar sesión.");
		const row = await ctx.db
			.query("platformPreferences")
			.withIndex("by_user", (q) => q.eq("userId", userId))
			.unique();
		return {
			providers: row?.providers ?? [],
			stremioEnabled: row?.stremioEnabled ?? false,
		};
	},
});

export const savePreferences = mutation({
	args: { providers: v.array(v.string()), stremioEnabled: v.boolean() },
	returns: v.null(),
	handler: async (ctx, { providers, stremioEnabled }) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new Error("Debes iniciar sesión.");
		if (providers.length > MAX_PROVIDERS)
			throw new Error("Selecciona hasta 30 plataformas.");
		const normalized = new Map<string, string>();
		for (const provider of providers) {
			const name = provider.trim().replace(/\s+/g, " ");
			if (!name || name.length > MAX_PROVIDER_LENGTH)
				throw new Error("Nombre de plataforma inválido.");
			const key = name.toLocaleLowerCase("es-CL");
			if (!normalized.has(key)) normalized.set(key, name);
		}
		const row = await ctx.db
			.query("platformPreferences")
			.withIndex("by_user", (q) => q.eq("userId", userId))
			.unique();
		const value = {
			providers: [...normalized.values()],
			stremioEnabled,
			updatedAt: Date.now(),
		};
		if (row) await ctx.db.patch(row._id, value);
		else await ctx.db.insert("platformPreferences", { userId, ...value });
		return null;
	},
});
