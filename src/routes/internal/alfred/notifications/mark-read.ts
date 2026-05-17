import { api as convexApi } from "@convex/_generated/api";
import { createFileRoute } from "@tanstack/react-router";
import { createConvexServerClient } from "@/lib/server/convex";
import { json, jsonError, readJson } from "@/lib/server/http";

function assertAlfredSecret(request: Request) {
	const expected = process.env.ALFRED_NOTIFY_SECRET;
	if (!expected) {
		throw new Error("Falta ALFRED_NOTIFY_SECRET.");
	}

	if (request.headers.get("x-library-secret") !== expected) {
		throw new Error("No autorizado.");
	}
}

export const Route = createFileRoute(
	"/internal/alfred/notifications/mark-read",
)({
	server: {
		handlers: {
			POST: async ({ request }) => {
				try {
					assertAlfredSecret(request);
				} catch (error) {
					const message =
						error instanceof Error ? error.message : "No autorizado.";
					return jsonError(message, message.includes("Falta") ? 500 : 401);
				}

				const body = await readJson<{ eventId?: string }>(request);
				if (!body || typeof body.eventId !== "string" || !body.eventId.trim()) {
					return jsonError("Payload invalido.");
				}

				const client = createConvexServerClient();
				return json(
					await client.mutation(convexApi.notifications.markRead, {
						secret: request.headers.get("x-library-secret") ?? "",
						eventId: body.eventId,
					}),
				);
			},
		},
	},
});
