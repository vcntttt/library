import { api as convexApi } from "@convex/_generated/api";
import { createFileRoute } from "@tanstack/react-router";
import {
	createConvexServerClient,
	isForbiddenIntegrationError,
	isIntegrationOwnerNotConfiguredError,
	isUnauthorizedError,
	requireReadingIntegrationOwner,
} from "@/lib/server/convex";
import { json, jsonError } from "@/lib/server/http";
import { listIdeaFiles } from "@/lib/server/idea-files";

export const Route = createFileRoute("/api/ideas/sync")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				try {
					await requireReadingIntegrationOwner(request);
				} catch (error) {
					if (isIntegrationOwnerNotConfiguredError(error)) {
						return jsonError(
							"Falta configurar READING_INTEGRATION_OWNER_ID.",
							503,
						);
					}
					if (isForbiddenIntegrationError(error)) {
						return jsonError("No autorizado.", 403);
					}
					if (!isUnauthorizedError(error)) {
						console.error("[ideas/sync] session validation failed", error);
					}
					return jsonError("No autorizado.", 401);
				}
				const vaultPath = process.env.OBSIDIAN_VAULT_PATH;
				const token = request.headers
					.get("authorization")
					?.replace(/^Bearer\s+/i, "");
				if (!vaultPath) return jsonError("Falta OBSIDIAN_VAULT_PATH.", 503);
				if (!token) return jsonError("No autorizado.", 401);

				try {
					const files = await listIdeaFiles(vaultPath);
					const client = createConvexServerClient();
					client.setAuth(token);
					for (const idea of files) {
						const { content: _content, ...ideaIndex } = idea;
						await client.mutation(convexApi.ideas.upsert, { idea: ideaIndex });
					}
					return json({ syncedIdeas: files.length });
				} catch (error) {
					return jsonError(
						error instanceof Error
							? error.message
							: "No se pudieron sincronizar las ideas.",
						500,
					);
				}
			},
		},
	},
});
