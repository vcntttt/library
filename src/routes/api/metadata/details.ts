import { createFileRoute } from "@tanstack/react-router";
import { getMetadataDetails } from "@/lib/metadata/providers";
import type { MetadataSource } from "@/lib/metadata/types";
import {
	isUnauthorizedError,
	requireConvexSessionFromRequest,
} from "@/lib/server/convex";
import { json, jsonError } from "@/lib/server/http";
import type { ObraType } from "@/lib/types";

const metadataSources = [
	"google-books",
	"open-library",
	"apple-books",
	"tmdb",
	"anilist",
] as const;

const obraTypes = [
	"book",
	"movie",
	"series",
	"anime",
	"manga",
	"manhwa",
] as const;

const isMetadataSource = (value: string): value is MetadataSource =>
	(metadataSources as readonly string[]).includes(value);

const isObraType = (value: string): value is ObraType =>
	(obraTypes as readonly string[]).includes(value);

export const Route = createFileRoute("/api/metadata/details")({
	server: {
		handlers: {
			GET: async ({ request }) => {
				try {
					await requireConvexSessionFromRequest(request);
				} catch (error) {
					if (!isUnauthorizedError(error)) {
						console.error(
							"[metadata/details] session validation failed",
							error,
						);
						return jsonError("No se pudo validar la sesion.", 500);
					}
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
