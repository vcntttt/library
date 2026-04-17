import { createFileRoute } from "@tanstack/react-router";
import { requireSessionFromRequest } from "@/lib/auth-server";
import {
	json,
	jsonError,
	readJson,
	withUnauthorizedGuard,
} from "@/lib/server/http";
import { createObra, listObras } from "@/lib/server/obras";
import { ensureAppRuntimeStarted } from "@/lib/server/runtime";
import type { CreateObraInput, ObraStatus, ObraType } from "@/lib/types";

export const Route = createFileRoute("/api/obras")({
	server: {
		handlers: {
			GET: ({ request }) =>
				withUnauthorizedGuard(
					async () => {
						ensureAppRuntimeStarted();
						const session = await requireSessionFromRequest(request);
						const url = new URL(request.url);
						return listObras(session.user.id, {
							status: (url.searchParams.get("status") ?? undefined) as
								| ObraStatus
								| undefined,
							type: (url.searchParams.get("type") ?? undefined) as
								| ObraType
								| undefined,
							limit: url.searchParams.get("limit")
								? Number(url.searchParams.get("limit"))
								: undefined,
						});
					},
					(value) => json(value),
				),
			POST: ({ request }) =>
				withUnauthorizedGuard(
					async () => {
						ensureAppRuntimeStarted();
						const session = await requireSessionFromRequest(request);
						const body = await readJson<CreateObraInput>(request);
						if (!body) {
							return jsonError("Payload invalido.");
						}

						return createObra(session.user.id, body);
					},
					(value) => (value instanceof Response ? value : json(value, 201)),
				),
		},
	},
});
