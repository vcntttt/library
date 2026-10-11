import { createFileRoute } from "@tanstack/react-router";
import {
	isForbiddenIntegrationError,
	isIntegrationOwnerNotConfiguredError,
	isUnauthorizedError,
	requireReadingIntegrationOwner,
} from "@/lib/server/convex";
import { json, jsonError, readJson } from "@/lib/server/http";
import {
	InvalidIdeaPathError,
	readIdeaFile,
	writeIdeaFile,
} from "@/lib/server/idea-files";

export const Route = createFileRoute("/api/ideas/content")({
	server: {
		handlers: {
			GET: async ({ request }) => {
				const accessError = await validateSession(request);
				if (accessError) return accessError;
				const relativePath = new URL(request.url).searchParams.get("path");
				const vaultPath = process.env.OBSIDIAN_VAULT_PATH;
				if (!vaultPath) return jsonError("Falta OBSIDIAN_VAULT_PATH.", 503);
				if (!relativePath) return jsonError("Falta la ruta de la idea.");

				try {
					return json(await readIdeaFile(vaultPath, relativePath));
				} catch (error) {
					if (error instanceof InvalidIdeaPathError) {
						return jsonError(error.message, 400);
					}
					return jsonError("No se pudo leer la idea.", 404);
				}
			},
			PUT: async ({ request }) => {
				const accessError = await validateSession(request);
				if (accessError) return accessError;
				const vaultPath = process.env.OBSIDIAN_VAULT_PATH;
				if (!vaultPath) return jsonError("Falta OBSIDIAN_VAULT_PATH.", 503);
				const body = await readJson<{
					relativePath?: string;
					content?: string;
					expectedHash?: string;
				}>(request);
				if (!body?.relativePath || typeof body.content !== "string") {
					return jsonError("La ruta y el contenido son obligatorios.");
				}
				// Sin hash esperado la escritura pisaría ediciones hechas en Obsidian.
				if (!body.expectedHash) {
					return jsonError("Falta el contentHash esperado de la idea.");
				}

				try {
					const result = await writeIdeaFile(
						vaultPath,
						body.relativePath,
						body.content,
						body.expectedHash,
					);
					if (result.conflict) {
						return json(
							{
								error: "conflict",
								current: result.current,
							},
							409,
						);
					}
					return json(result.current);
				} catch (error) {
					if (error instanceof InvalidIdeaPathError) {
						return jsonError(error.message, 400);
					}
					return jsonError("No se pudo guardar la idea.", 500);
				}
			},
		},
	},
});

async function validateSession(request: Request) {
	try {
		await requireReadingIntegrationOwner(request);
		return null;
	} catch (error) {
		if (isIntegrationOwnerNotConfiguredError(error)) {
			return jsonError("Falta configurar READING_INTEGRATION_OWNER_ID.", 503);
		}
		if (isForbiddenIntegrationError(error))
			return jsonError("No autorizado.", 403);
		if (!isUnauthorizedError(error)) {
			console.error("[ideas/content] session validation failed", error);
		}
		return jsonError("No autorizado.", 401);
	}
}
