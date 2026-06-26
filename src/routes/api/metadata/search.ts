import { createFileRoute } from "@tanstack/react-router";
import { providerByType, searchMetadata } from "@/lib/metadata/providers";
import type { MetadataSource } from "@/lib/metadata/types";
import {
	isUnauthorizedError,
	requireConvexSessionFromRequest,
} from "@/lib/server/convex";
import { json, jsonError } from "@/lib/server/http";
import type { ObraType } from "@/lib/types";

const obraTypes = [
	"book",
	"movie",
	"series",
	"anime",
	"manga",
	"manhwa",
] as const;
const metadataSources = [
	"google-books",
	"open-library",
	"apple-books",
	"tmdb",
	"anilist",
	"manhwaweb",
] as const;

const isObraType = (value: string): value is ObraType =>
	(obraTypes as readonly string[]).includes(value);

const isMetadataSource = (value: string): value is MetadataSource =>
	(metadataSources as readonly string[]).includes(value);

export const Route = createFileRoute("/api/metadata/search")({
	server: {
		handlers: {
			GET: async ({ request }) => {
				try {
					await requireConvexSessionFromRequest(request);
				} catch (error) {
					if (!isUnauthorizedError(error)) {
						console.error("[metadata/search] session validation failed", error);
						return jsonError("No se pudo validar la sesion.", 500);
					}
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
