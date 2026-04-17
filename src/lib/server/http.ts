const jsonHeaders = {
	"content-type": "application/json; charset=utf-8",
};

export function json(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: jsonHeaders,
	});
}

export function jsonError(
	message: string,
	status = 400,
	extra?: Record<string, unknown>,
) {
	return json({ error: message, ...extra }, status);
}

export async function readJson<T>(request: Request) {
	return (await request.json().catch(() => null)) as T | null;
}

export async function withUnauthorizedGuard<T>(
	handler: () => Promise<T>,
	map: (value: T) => Response,
) {
	try {
		return map(await handler());
	} catch (error) {
		if (error instanceof Error && error.message === "No autorizado.") {
			return jsonError(error.message, 401);
		}

		throw error;
	}
}
