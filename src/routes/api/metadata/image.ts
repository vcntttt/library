import { createFileRoute } from "@tanstack/react-router";
import { isAllowedManhwaWebImageUrl } from "@/lib/metadata/providers";
import { jsonError } from "@/lib/server/http";

const IMAGE_CACHE_CONTROL =
	"public, max-age=86400, stale-while-revalidate=604800";

export const Route = createFileRoute("/api/metadata/image")({
	server: {
		handlers: {
			GET: async ({ request }) => {
				const requestUrl = new URL(request.url);
				const imageUrl = requestUrl.searchParams.get("url")?.trim() ?? "";

				if (!imageUrl || !isAllowedManhwaWebImageUrl(imageUrl)) {
					return jsonError("Imagen invalida.", 400);
				}

				try {
					const upstream = await fetch(imageUrl, {
						headers: {
							Referer: "https://www.manhwaweb.com/",
							"User-Agent": "Mozilla/5.0 (compatible; LibraryMetadataBot/1.0)",
						},
					});

					if (!upstream.ok || !upstream.body) {
						return jsonError("No se pudo cargar la imagen.", 502);
					}

					const contentType =
						upstream.headers.get("content-type") ?? "application/octet-stream";
					if (!contentType.toLowerCase().startsWith("image/")) {
						return jsonError("La respuesta no es una imagen.", 502);
					}

					const headers = new Headers({
						"cache-control": IMAGE_CACHE_CONTROL,
						"content-type": contentType,
					});
					const contentLength = upstream.headers.get("content-length");
					if (contentLength) headers.set("content-length", contentLength);

					return new Response(upstream.body, {
						status: 200,
						headers,
					});
				} catch (error) {
					console.error("[metadata/image] proxy failed", error);
					return jsonError("No se pudo cargar la imagen.", 502);
				}
			},
		},
	},
});
