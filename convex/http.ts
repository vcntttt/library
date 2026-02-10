import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { authComponent, createAuth } from "./auth";

const http = httpRouter();

authComponent.registerRoutes(http, createAuth);

const assertAlfredSecret = (req: Request) => {
	const expected = process.env.ALFRED_NOTIFY_SECRET;
	if (!expected) {
		throw new Error("Falta ALFRED_NOTIFY_SECRET en Convex.");
	}

	const provided = req.headers.get("x-library-secret");
	if (provided !== expected) {
		throw new Error("No autorizado.");
	}
};

http.route({
	path: "/internal/alfred/notifications/pull",
	method: "POST",
	handler: httpAction(async (ctx, req) => {
		try {
			assertAlfredSecret(req);
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "No autorizado.";
			return new Response(JSON.stringify({ error: message }), {
				status: message.includes("Falta") ? 500 : 401,
				headers: { "content-type": "application/json; charset=utf-8" },
			});
		}

		const body = (await req.json().catch(() => ({}))) as {
			limit?: number;
		};
		const result = await ctx.runMutation(
			internal.mangaReleases.pullNotificationEvents,
			{ limit: body.limit },
		);

		return new Response(JSON.stringify(result), {
			status: 200,
			headers: { "content-type": "application/json; charset=utf-8" },
		});
	}),
});

http.route({
	path: "/internal/alfred/notifications/ack",
	method: "POST",
	handler: httpAction(async (ctx, req) => {
		try {
			assertAlfredSecret(req);
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "No autorizado.";
			return new Response(JSON.stringify({ error: message }), {
				status: message.includes("Falta") ? 500 : 401,
				headers: { "content-type": "application/json; charset=utf-8" },
			});
		}

		const body = (await req.json().catch(() => null)) as
			| { eventId?: string; status?: "delivered" | "failed"; error?: string }
			| null;
		if (
			!body ||
			typeof body.eventId !== "string" ||
			(body.status !== "delivered" && body.status !== "failed")
		) {
			return new Response(JSON.stringify({ error: "Payload invalido." }), {
				status: 400,
				headers: { "content-type": "application/json; charset=utf-8" },
			});
		}

		const result = await ctx.runMutation(
			internal.mangaReleases.ackNotificationEvent,
			{
				eventId: body.eventId,
				status: body.status,
				error: body.error,
			},
		);

		return new Response(JSON.stringify(result), {
			status: 200,
			headers: { "content-type": "application/json; charset=utf-8" },
		});
	}),
});

export default http;
