import { api as convexApi } from "@convex/_generated/api";
import { createFileRoute } from "@tanstack/react-router";
import {
	createConvexServerClient,
	isForbiddenIntegrationError,
	isIntegrationOwnerNotConfiguredError,
	isUnauthorizedError,
	requireReadingIntegrationOwner,
} from "@/lib/server/convex";
import { json, jsonError, readJson } from "@/lib/server/http";
import { createIdeaFile } from "@/lib/server/idea-files";

export const Route = createFileRoute("/api/ideas/")({
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
						console.error("[ideas] session validation failed", error);
					}
					return jsonError("No autorizado.", 401);
				}

				const vaultPath = process.env.OBSIDIAN_VAULT_PATH;
				const token = request.headers
					.get("authorization")
					?.replace(/^Bearer\s+/i, "");
				if (!vaultPath) return jsonError("Falta OBSIDIAN_VAULT_PATH.", 503);
				if (!token) return jsonError("No autorizado.", 401);

				const body = await readJson<{ title?: string; content?: string }>(
					request,
				);
				const title = body?.title?.trim();
				if (!title) return jsonError("El título es obligatorio.");
				if (body?.content !== undefined && typeof body.content !== "string") {
					return jsonError("El contenido debe ser texto.");
				}

				try {
					const file = await createIdeaFile(
						vaultPath,
						title,
						body?.content ?? "",
					);
					const client = createConvexServerClient();
					client.setAuth(token);
					const { content: _content, ...idea } = file;
					await client.mutation(convexApi.ideas.upsert, { idea });
					return json(file, 201);
				} catch (error) {
					return jsonError(
						error instanceof Error
							? error.message
							: "No se pudo crear la idea.",
						500,
					);
				}
			},
		},
	},
});
