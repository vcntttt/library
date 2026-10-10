import { createFileRoute } from "@tanstack/react-router";
import { isAllowedManhwaWebImageUrl } from "@/lib/metadata/providers";
import { jsonError } from "@/lib/server/http";

const IMAGE_CACHE_CONTROL =
	"public, max-age=86400, stale-while-revalidate=604800";
const IMAGE_FETCH_TIMEOUT_MS = 10_000;
const IMAGE_MAX_BYTES = 10 * 1024 * 1024;
const IMAGE_MAX_REDIRECTS = 3;
// Solo formatos de mapa de bits: un SVG servido desde este origen podría ejecutar scripts.
const ALLOWED_IMAGE_TYPE = /^image\/(jpe?g|pjpeg|png|gif|webp|avif)(;|$)/i;

async function fetchImageFromAllowedHosts(imageUrl: string) {
	let target = imageUrl;
	for (let redirects = 0; redirects <= IMAGE_MAX_REDIRECTS; redirects += 1) {
		// Con redirect manual, cada salto debe seguir en hosts permitidos.
		const upstream = await fetch(target, {
			headers: {
				Referer: "https://www.manhwaweb.com/",
				"User-Agent": "Mozilla/5.0 (compatible; LibraryMetadataBot/1.0)",
			},
			redirect: "manual",
			signal: AbortSignal.timeout(IMAGE_FETCH_TIMEOUT_MS),
		});
		const location = upstream.headers.get("location");
		if (upstream.status < 300 || upstream.status > 399 || !location) {
			return upstream;
		}
		target = new URL(location, target).toString();
		if (!isAllowedManhwaWebImageUrl(target)) return undefined;
	}
	return undefined;
}

function limitBytes(maxBytes: number) {
	let total = 0;
	return new TransformStream<Uint8Array, Uint8Array>({
		transform(chunk, controller) {
			total += chunk.byteLength;
			if (total > maxBytes) {
				controller.error(new Error("La imagen supera el tamaño permitido."));
				return;
			}
			controller.enqueue(chunk);
		},
	});
}

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
					const upstream = await fetchImageFromAllowedHosts(imageUrl);

					if (!upstream?.ok || !upstream.body) {
						return jsonError("No se pudo cargar la imagen.", 502);
					}

					const contentType =
						upstream.headers.get("content-type") ?? "application/octet-stream";
					if (!ALLOWED_IMAGE_TYPE.test(contentType)) {
						return jsonError("La respuesta no es una imagen compatible.", 502);
					}

					const contentLength = upstream.headers.get("content-length");
					if (contentLength && Number(contentLength) > IMAGE_MAX_BYTES) {
						return jsonError("La imagen supera el tamaño permitido.", 502);
					}

					const headers = new Headers({
						"cache-control": IMAGE_CACHE_CONTROL,
						"content-type": contentType,
						"x-content-type-options": "nosniff",
					});
					if (contentLength) headers.set("content-length", contentLength);

					return new Response(
						upstream.body.pipeThrough(limitBytes(IMAGE_MAX_BYTES)),
						{
							status: 200,
							headers,
						},
					);
				} catch (error) {
					console.error("[metadata/image] proxy failed", error);
					return jsonError("No se pudo cargar la imagen.", 502);
				}
			},
		},
	},
});
