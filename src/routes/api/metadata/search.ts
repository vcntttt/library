import { createFileRoute } from "@tanstack/react-router";
import { requireSessionFromRequest } from "@/lib/auth-server";
import { providerByType, searchMetadata } from "@/lib/metadata/providers";
import type { MetadataSource } from "@/lib/metadata/types";
import { json, jsonError } from "@/lib/server/http";
import { ensureAppRuntimeStarted } from "@/lib/server/runtime";
import type { ObraType } from "@/lib/types";

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
				ensureAppRuntimeStarted();
				try {
					await requireSessionFromRequest(request);
				} catch {
					return jsonError("No autorizado.", 401);
				}

				const url = new URL(request.url);
				const query = url.searchParams.get("q")?.trim() ?? "";
				const typeParam = url.searchParams.get("type")?.trim() ?? "";
				if (!query || !typeParam || !isObraType(typeParam)) {
					return jsonError("Parametros invalidos.");
				}

				const providerParam = url.searchParams.get("provider")?.trim() ?? "";
				const provider = providerParam
					? isMetadataSource(providerParam)
						? providerParam
						: null
					: providerByType[typeParam];
				if (!provider) {
					return jsonError("Provider invalido.");
				}

				try {
					const outcome = await searchMetadata(provider, query, typeParam);
					return json(outcome);
				} catch (error) {
					return jsonError(
						error instanceof Error
							? error.message
							: "No se pudo consultar metadatos.",
					);
				}
			},
		},
	},
});
