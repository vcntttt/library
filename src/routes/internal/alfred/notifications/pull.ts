import { createFileRoute } from "@tanstack/react-router";
import { json, jsonError, readJson } from "@/lib/server/http";
import { pullNotificationEvents } from "@/lib/server/notifications";
import { ensureAppRuntimeStarted } from "@/lib/server/runtime";

function assertAlfredSecret(request: Request) {
	const expected = process.env.ALFRED_NOTIFY_SECRET;
	if (!expected) {
		throw new Error("Falta ALFRED_NOTIFY_SECRET.");
	}

	if (request.headers.get("x-library-secret") !== expected) {
		throw new Error("No autorizado.");
	}
}

export const Route = createFileRoute("/internal/alfred/notifications/pull")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				ensureAppRuntimeStarted();
				try {
					assertAlfredSecret(request);
				} catch (error) {
					const message =
						error instanceof Error ? error.message : "No autorizado.";
					return jsonError(message, message.includes("Falta") ? 500 : 401);
				}

				const body = await readJson<{ limit?: number }>(request);
				return json(await pullNotificationEvents(body?.limit));
			},
		},
	},
});
