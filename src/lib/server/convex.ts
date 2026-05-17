import { api as convexApi } from "@convex/_generated/api";
import { ConvexHttpClient } from "convex/browser";

function getConvexUrl() {
	const url =
		process.env.CONVEX_URL ??
		process.env.CONVEX_SELF_HOSTED_URL ??
		process.env.VITE_CONVEX_URL ??
		"https://convex-library.tailf8b14c.ts.net:3210";
	if (!url) throw new Error("Falta VITE_CONVEX_URL.");
	return url;
}

export function createConvexServerClient() {
	return new ConvexHttpClient(getConvexUrl());
}

export async function requireConvexSessionFromRequest(request: Request) {
	const authHeader = request.headers.get("authorization");
	const token = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1];
	if (!token) throw new Error("No autorizado.");

	const client = createConvexServerClient();
	client.setAuth(token);
	const user = await client.query(convexApi.users.current, {});
	if (!user) throw new Error("No autorizado.");
	return user;
}
