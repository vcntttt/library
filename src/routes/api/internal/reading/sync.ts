import { timingSafeEqual } from "node:crypto";
import { createFileRoute } from "@tanstack/react-router";
import { createConvexServiceClient } from "@/lib/server/convex";
import { json, jsonError } from "@/lib/server/http";
import { runReadingSync } from "@/lib/server/reading-sync";

export const Route = createFileRoute("/api/internal/reading/sync")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				const ownerId = process.env.READING_INTEGRATION_OWNER_ID;
				const expectedSecret = process.env.READING_SYNC_SECRET;
				const rootPath = process.env.READING_BOOKS_PATH;
				if (!ownerId) {
					return jsonError(
						"Falta configurar READING_INTEGRATION_OWNER_ID.",
						503,
					);
				}
				if (!expectedSecret)
					return jsonError("Falta configurar READING_SYNC_SECRET.", 503);
				if (!rootPath)
					return jsonError("Falta configurar READING_BOOKS_PATH.", 503);

				const receivedSecret =
					request.headers.get("x-reading-sync-secret") ??
					request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
				if (!receivedSecret || !sameSecret(receivedSecret, expectedSecret)) {
					return jsonError("No autorizado.", 401);
				}

				try {
					const client = createConvexServiceClient(ownerId);
					return json(await runReadingSync(client, rootPath, "automatic"));
				} catch (error) {
					console.error("[reading/internal-sync] import failed", error);
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

function sameSecret(received: string, expected: string) {
	const receivedBytes = Buffer.from(received);
	const expectedBytes = Buffer.from(expected);
	return (
		receivedBytes.length === expectedBytes.length &&
		timingSafeEqual(receivedBytes, expectedBytes)
	);
}
