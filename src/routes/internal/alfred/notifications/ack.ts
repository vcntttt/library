import { createFileRoute } from "@tanstack/react-router";
import { json, jsonError, readJson } from "@/lib/server/http";
import { ackNotificationEvent } from "@/lib/server/notifications";
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

export const Route = createFileRoute("/internal/alfred/notifications/ack")({
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

				const body = await readJson<{
					eventId?: string;
					status?: "delivered" | "failed";
					error?: string;
				}>(request);
				if (
					!body ||
					typeof body.eventId !== "string" ||
					(body.status !== "delivered" && body.status !== "failed")
				) {
					return jsonError("Payload invalido.");
				}

				return json(
					await ackNotificationEvent(body.eventId, body.status, body.error),
				);
			},
		},
	},
});
