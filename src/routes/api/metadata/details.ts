import { createFileRoute } from "@tanstack/react-router";
import { requireSessionFromRequest } from "@/lib/auth-server";
import { getMetadataDetails } from "@/lib/metadata/providers";
import type { MetadataSource } from "@/lib/metadata/types";
import { json, jsonError } from "@/lib/server/http";
import { ensureAppRuntimeStarted } from "@/lib/server/runtime";
import type { ObraType } from "@/lib/types";

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
				ensureAppRuntimeStarted();
				try {
					await requireSessionFromRequest(request);
				} catch {
					return jsonError("No autorizado.", 401);
				}

				const url = new URL(request.url);
				const sourceParam = url.searchParams.get("source")?.trim() ?? "";
				const id = url.searchParams.get("id")?.trim() ?? "";
				const typeParam = url.searchParams.get("type")?.trim() ?? "";
				const obraType = isObraType(typeParam) ? typeParam : undefined;

				if (!id || !isMetadataSource(sourceParam)) {
					return jsonError("Parametros invalidos.");
				}

				try {
					const details = await getMetadataDetails(sourceParam, id, obraType);
					return json({ details });
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
