import { createFileRoute } from "@tanstack/react-router";
import { requireSessionFromRequest } from "@/lib/auth-server";
import { buildObsidianOpenUrl, resolveVaultFile } from "@/lib/obsidian-server";
import { json, jsonError } from "@/lib/server/http";
import { ensureAppRuntimeStarted } from "@/lib/server/runtime";

export const Route = createFileRoute("/api/obsidian/open")({
	server: {
		handlers: {
			GET: async ({ request }) => {
				ensureAppRuntimeStarted();
				try {
					await requireSessionFromRequest(request);
				} catch {
					return jsonError("No autorizado.", 401);
				}

				const url = new URL(request.url);
				const relativePath = url.searchParams.get("path")?.trim() ?? "";
				if (!relativePath) {
					return jsonError("Falta el path de Obsidian.");
				}

				try {
					const absolutePath = await resolveVaultFile(relativePath);
					return json({ url: buildObsidianOpenUrl(absolutePath) });
				} catch (error) {
					return jsonError(
						error instanceof Error
							? error.message
							: "No se pudo abrir Obsidian.",
					);
				}
			},
		},
	},
});
