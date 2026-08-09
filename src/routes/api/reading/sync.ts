import { createFileRoute } from "@tanstack/react-router";
import {
	createConvexServerClient,
	isForbiddenIntegrationError,
	isIntegrationOwnerNotConfiguredError,
	isUnauthorizedError,
	requireReadingIntegrationOwner,
} from "@/lib/server/convex";
import { json, jsonError } from "@/lib/server/http";
import { runReadingSync } from "@/lib/server/reading-sync";

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
					if (isForbiddenIntegrationError(error))
						return jsonError("No autorizado.", 403);
					if (!isUnauthorizedError(error)) {
						console.error("[reading/sync] session validation failed", error);
					}
					return jsonError(
						"No autorizado.",
						isUnauthorizedError(error) ? 401 : 500,
					);
				}

				const rootPath = process.env.READING_BOOKS_PATH;
				const token = request.headers
					.get("authorization")
					?.replace(/^Bearer\s+/i, "");
				if (!rootPath)
					return jsonError(
						"Falta configurar READING_BOOKS_PATH en el servidor.",
						503,
					);
				if (!token) return jsonError("No autorizado.", 401);

				const client = createConvexServerClient();
				client.setAuth(token);
				try {
					return json(await runReadingSync(client, rootPath, "manual"));
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
