import { createFileRoute } from "@tanstack/react-router";
import { getTokenFromRequest } from "@/lib/auth-server";
import { buildObsidianOpenUrl, resolveVaultFile } from "@/lib/obsidian-server";

const jsonHeaders = {
	"Content-Type": "application/json",
};

export const Route = createFileRoute("/api/obsidian/open")({
	server: {
		handlers: {
			GET: async ({ request }) => {
				const token = await getTokenFromRequest(request);
				if (!token) {
					return new Response(JSON.stringify({ error: "No autorizado." }), {
						status: 401,
						headers: jsonHeaders,
					});
				}

				const url = new URL(request.url);
				const relativePath = url.searchParams.get("path")?.trim() ?? "";
				if (!relativePath) {
					return new Response(
						JSON.stringify({ error: "Falta el path de Obsidian." }),
						{ status: 400, headers: jsonHeaders },
					);
				}

				try {
					const absolutePath = await resolveVaultFile(relativePath);
					const obsidianUrl = buildObsidianOpenUrl(absolutePath);
					return new Response(JSON.stringify({ url: obsidianUrl }), {
						status: 200,
						headers: jsonHeaders,
					});
				} catch (error) {
					return new Response(
						JSON.stringify({
							error:
								error instanceof Error
									? error.message
									: "No se pudo abrir Obsidian.",
						}),
						{ status: 400, headers: jsonHeaders },
					);
				}
			},
		},
	},
});
