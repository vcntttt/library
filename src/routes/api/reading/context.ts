import { readFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { api as convexApi } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { createFileRoute } from "@tanstack/react-router";
import {
	createConvexServerClient,
	isForbiddenIntegrationError,
	isIntegrationOwnerNotConfiguredError,
	isUnauthorizedError,
	requireReadingIntegrationOwner,
} from "@/lib/server/convex";
import { extractEpubContext } from "@/lib/server/epub-context";
import { json, jsonError, readJson } from "@/lib/server/http";

export const Route = createFileRoute("/api/reading/context")({
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
					if (isForbiddenIntegrationError(error))
						return jsonError("No autorizado.", 403);
					return jsonError(
						!isUnauthorizedError(error)
							? "No se pudo validar la sesión."
							: "No autorizado.",
						!isUnauthorizedError(error) ? 500 : 401,
					);
				}

				const body = await readJson<{ annotationId?: string; text?: string }>(
					request,
				);
				const token = request.headers
					.get("authorization")
					?.replace(/^Bearer\s+/i, "");
				if (!token) return jsonError("No autorizado.", 401);
				if (!body?.annotationId) return jsonError("Falta annotationId.");

				try {
					const client = createConvexServerClient();
					client.setAuth(token);
					const source = await client.query(
						convexApi.reading.getAnnotationContextSource,
						{
							id: body.annotationId as Id<"readingAnnotations">,
						},
					);
					if (!source) return jsonError("Anotación no encontrada.", 404);
					if (source.format !== "epub") {
						return json({ status: "unsupported", candidates: [] });
					}
					const root = process.env.READING_BOOKS_PATH;
					if (!root)
						return jsonError("Falta configurar READING_BOOKS_PATH.", 503);
					const absolutePath = resolve(root, source.sourcePath);
					const absoluteRoot = resolve(root);
					if (
						absolutePath !== absoluteRoot &&
						!absolutePath.startsWith(`${absoluteRoot}${sep}`)
					) {
						return jsonError("La fuente de lectura no es válida.", 400);
					}
					const epub = await readFile(absolutePath);
					return json({
						...extractEpubContext(epub, body.text ?? source.text),
					});
				} catch (error) {
					console.error("[reading/context] extraction failed", error);
					return jsonError(
						error instanceof Error
							? error.message
							: "No se pudo extraer el contexto.",
						500,
					);
				}
			},
		},
	},
});
