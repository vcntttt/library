import { createFileRoute } from "@tanstack/react-router";
import { requireSessionFromRequest } from "@/lib/auth-server";
import {
	json,
	jsonError,
	readJson,
	withUnauthorizedGuard,
} from "@/lib/server/http";
import { getObra, removeObra, updateObra } from "@/lib/server/obras";
import { ensureAppRuntimeStarted } from "@/lib/server/runtime";
import type { UpdateObraPatch } from "@/lib/types";

export const Route = createFileRoute("/api/obras/$obraId")({
	server: {
		handlers: {
			GET: ({ request, params }) =>
				withUnauthorizedGuard(
					async () => {
						ensureAppRuntimeStarted();
						const session = await requireSessionFromRequest(request);
						return getObra(session.user.id, params.obraId);
					},
					(value) => json(value),
				),
			PATCH: ({ request, params }) =>
				withUnauthorizedGuard(
					async () => {
						ensureAppRuntimeStarted();
						const session = await requireSessionFromRequest(request);
						const body = await readJson<{ patch?: UpdateObraPatch }>(request);
						if (!body?.patch) {
							return jsonError("Payload invalido.");
						}

						return updateObra(session.user.id, params.obraId, body.patch);
					},
					(value) => (value instanceof Response ? value : json(value)),
				),
			DELETE: ({ request, params }) =>
				withUnauthorizedGuard(
					async () => {
						ensureAppRuntimeStarted();
						const session = await requireSessionFromRequest(request);
						return removeObra(session.user.id, params.obraId);
					},
					(value) => json(value),
				),
		},
	},
});
