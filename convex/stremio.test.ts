import { type FunctionReference, getFunctionName } from "convex/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Id } from "./_generated/dataModel";
import type { ActionCtx } from "./_generated/server";
import { syncUser } from "./stremio";

afterEach(() => vi.unstubAllGlobals());

const handler = (
	syncUser as unknown as {
		_handler: (
			ctx: ActionCtx,
			args: { userId: Id<"users">; force: boolean },
		) => Promise<null>;
	}
)._handler;

describe("sincronización incremental de Stremio", () => {
	it("deja pendiente una obra sin metadata y continúa importando las siguientes", async () => {
		const writes: Array<{ name: string; args: Record<string, unknown> }> = [];
		const context = {
			runMutation: async (
				reference: FunctionReference<"mutation">,
				args: Record<string, unknown>,
			) => {
				const name = getFunctionName(reference);
				writes.push({ name, args });
				if (name === "stremio:claimSync")
					return { authKey: "fixture", version: 1 };
				return name === "stremio:applyItem" ? true : null;
			},
			runQuery: async () => [],
		} as unknown as ActionCtx;
		vi.stubGlobal(
			"fetch",
			vi.fn(async (input: string | URL) => {
				const url = String(input);
				let data: unknown;
				if (url.endsWith("datastoreMeta"))
					data = {
						result: [
							["tt0000001", 1],
							["tt0000002", 2],
						],
					};
				else if (url.endsWith("datastoreGet"))
					data = {
						result: [1, 2].map((id) => ({
							_id: `tt000000${id}`,
							name: "Película de prueba",
							type: "movie",
							state: { flaggedWatched: 1 },
						})),
					};
				else if (url.includes("/find/tt0000001")) data = { movie_results: [] };
				else if (url.includes("/find/tt0000002"))
					data = { movie_results: [{ id: 42 }] };
				else if (url.includes("/watch/providers"))
					data = { results: { CL: { flatrate: [] } } };
				else data = { title: "Película de prueba", status: "Released" };
				return Response.json(data);
			}),
		);
		vi.stubEnv("TMDB_API_KEY", "fixture");
		try {
			await handler(context, {
				userId: "fixture-user" as Id<"users">,
				force: false,
			});
			const imported = writes.filter(
				(write) => write.name === "stremio:applyItem",
			);
			expect(imported).toHaveLength(1);
			expect(imported[0]?.args.item).toMatchObject({
				imdbId: "tt0000002",
				watchedMovie: true,
			});
			expect(
				writes.find(
					(write) =>
						write.name === "stremio:setPending" && write.args.pending === true,
				)?.args.id,
			).toBe("tt0000001");
			expect(
				writes.filter((write) => write.name === "stremio:checkpoint").at(-1)
					?.args.mtime,
			).toBe(2);
		} finally {
			vi.unstubAllEnvs();
		}
	});
});
