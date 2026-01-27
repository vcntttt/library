import { createFileRoute } from "@tanstack/react-router";
import { getToken } from "@/lib/auth-server";
import { getMetadataDetails } from "@/lib/metadata/providers";
import type { MetadataSource } from "@/lib/metadata/types";
import type { ObraType } from "@/lib/types";

const jsonHeaders = {
	"Content-Type": "application/json",
};

const metadataSources = [
	"google-books",
	"open-library",
	"tmdb",
	"anilist",
] as const;

const obraTypes = ["book", "movie", "series", "anime", "manga"] as const;

const isMetadataSource = (value: string): value is MetadataSource =>
	(metadataSources as readonly string[]).includes(value);

const isObraType = (value: string): value is ObraType =>
	(obraTypes as readonly string[]).includes(value);

export const Route = createFileRoute("/api/metadata/details")({
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
				const sourceParam = url.searchParams.get("source")?.trim() ?? "";
				const id = url.searchParams.get("id")?.trim() ?? "";
				const typeParam = url.searchParams.get("type")?.trim() ?? "";
				const obraType = isObraType(typeParam) ? typeParam : undefined;

				if (!id || !isMetadataSource(sourceParam)) {
					return new Response(
						JSON.stringify({ error: "Parametros invalidos." }),
						{ status: 400, headers: jsonHeaders },
					);
				}

				try {
					const details = await getMetadataDetails(sourceParam, id, obraType);
					return new Response(JSON.stringify({ details }), {
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
