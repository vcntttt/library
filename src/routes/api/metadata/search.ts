import { createFileRoute } from "@tanstack/react-router";
import { getToken } from "@/lib/auth-server";
import { providerByType, searchMetadata } from "@/lib/metadata/providers";
import type { MetadataSource } from "@/lib/metadata/types";
import type { ObraType } from "@/lib/types";

const jsonHeaders = {
	"Content-Type": "application/json",
};

const obraTypes = ["book", "movie", "series", "anime", "manga"] as const;
const metadataSources = [
	"google-books",
	"open-library",
	"tmdb",
	"anilist",
] as const;

const isObraType = (value: string): value is ObraType =>
	(obraTypes as readonly string[]).includes(value);

const isMetadataSource = (value: string): value is MetadataSource =>
	(metadataSources as readonly string[]).includes(value);

export const Route = createFileRoute("/api/metadata/search")({
	server: {
		handlers: {
			GET: async ({ request }) => {
				const token = await getToken();
				if (!token) {
					return new Response(JSON.stringify({ error: "No autorizado." }), {
						status: 401,
						headers: jsonHeaders,
					});
				}

				const url = new URL(request.url);
				const query = url.searchParams.get("q")?.trim() ?? "";
				const typeParam = url.searchParams.get("type")?.trim() ?? "";
				if (!query || !typeParam || !isObraType(typeParam)) {
					return new Response(
						JSON.stringify({ error: "Parametros invalidos." }),
						{ status: 400, headers: jsonHeaders },
					);
				}

				const providerParam = url.searchParams.get("provider")?.trim() ?? "";
				const provider = providerParam
					? isMetadataSource(providerParam)
						? providerParam
						: null
					: providerByType[typeParam];
				if (!provider) {
					return new Response(JSON.stringify({ error: "Provider invalido." }), {
						status: 400,
						headers: jsonHeaders,
					});
				}

				try {
					const results = await searchMetadata(provider, query, typeParam);
					return new Response(JSON.stringify({ provider, results }), {
						status: 200,
						headers: jsonHeaders,
					});
				} catch (error) {
					return new Response(
						JSON.stringify({
							error:
								error instanceof Error
									? error.message
									: "No se pudo consultar metadatos.",
						}),
						{ status: 400, headers: jsonHeaders },
					);
				}
			},
		},
	},
});
