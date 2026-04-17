import { auth } from "@/lib/server/auth";

export const handler = (request: Request) => auth.handler(request);

export const getSessionFromRequest = (request: Request) =>
	auth.api.getSession({ headers: request.headers });

export async function requireSessionFromRequest(request: Request) {
	const session = await getSessionFromRequest(request);
	if (!session) {
		throw new Error("No autorizado.");
	}

	return session;
}
