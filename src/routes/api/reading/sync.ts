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
import { scanReadingBooks } from "@/lib/server/reading-files";

export const Route = createFileRoute("/api/reading/sync")({
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
						console.error("[reading/sync] session validation failed", error);
						return jsonError("No se pudo validar la sesión.", 500);
					}
					return jsonError("No autorizado.", 401);
				}

				const rootPath = process.env.READING_BOOKS_PATH;
				if (!rootPath) {
					return jsonError(
						"Falta configurar READING_BOOKS_PATH en el servidor.",
						503,
					);
				}

				const token = request.headers
					.get("authorization")
					?.replace(/^Bearer\s+/i, "");
				if (!token) return jsonError("No autorizado.", 401);

				try {
					const files = await scanReadingBooks(rootPath);
					const client = createConvexServerClient();
					client.setAuth(token);
					for (const file of files) {
						await client.mutation(convexApi.reading.upsertDocument, {
							document: file,
						});
					}

					return json({ importedDocuments: files.length });
				} catch (error) {
					console.error("[reading/sync] import failed", error);
					return jsonError(
						error instanceof Error
							? error.message
							: "No se pudo importar la biblioteca de lectura.",
						500,
					);
				}
			},
		},
	},
});
