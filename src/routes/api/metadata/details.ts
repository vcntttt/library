import { createFileRoute } from "@tanstack/react-router";
import { getTokenFromRequest } from "@/lib/auth-server";
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
				const debugId = crypto.randomUUID();
				const requestUrl = new URL(request.url);
				const cookieHeader = request.headers.get("cookie") ?? "";
				const authDebug = {
					debugId,
					path: requestUrl.pathname,
					hasCookie: Boolean(cookieHeader),
					hasSessionCookie:
						cookieHeader.includes("better-auth.session_token") ||
						cookieHeader.includes("__Secure-better-auth.session_token"),
					hasJwtCookie:
						cookieHeader.includes("better-auth.jwt") ||
						cookieHeader.includes("__Secure-better-auth.jwt"),
					hasAuthorization: Boolean(request.headers.get("authorization")),
					host: request.headers.get("host"),
					xForwardedHost: request.headers.get("x-forwarded-host"),
					xForwardedProto: request.headers.get("x-forwarded-proto"),
					origin: request.headers.get("origin"),
				};

				let token: string | undefined;
				try {
					token = await getTokenFromRequest(request);
				} catch (error) {
					console.error("[api/metadata/details] getToken failed", {
						...authDebug,
						error: error instanceof Error ? error.message : String(error),
					});
					return new Response(
						JSON.stringify({
							error: "No autorizado.",
							debugId,
							reason: "token_fetch_failed",
						}),
						{ status: 401, headers: jsonHeaders },
					);
				}

				if (!token) {
					console.error("[api/metadata/details] missing auth token", authDebug);
					return new Response(
						JSON.stringify({
							error: "No autorizado.",
							debugId,
							reason: "token_missing",
						}),
						{ status: 401, headers: jsonHeaders },
					);
				}

				const url = requestUrl;
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
