import { api as convexApi } from "@convex/_generated/api";
import { ConvexHttpClient } from "convex/browser";

const unauthorizedMessage = "No autorizado.";

export class UnauthorizedError extends Error {
	constructor() {
		super(unauthorizedMessage);
		this.name = "UnauthorizedError";
	}
}

export class IntegrationOwnerNotConfiguredError extends Error {
	constructor() {
		super("Falta configurar READING_INTEGRATION_OWNER_ID.");
		this.name = "IntegrationOwnerNotConfiguredError";
	}
}

export class ForbiddenIntegrationError extends Error {
	constructor() {
		super("No autorizado.");
		this.name = "ForbiddenIntegrationError";
	}
}

export function isUnauthorizedError(error: unknown) {
	return (
		error instanceof UnauthorizedError ||
		(error instanceof Error && error.message === unauthorizedMessage)
	);
}

export function isForbiddenIntegrationError(error: unknown) {
	return error instanceof ForbiddenIntegrationError;
}

export function isIntegrationOwnerNotConfiguredError(error: unknown) {
	return error instanceof IntegrationOwnerNotConfiguredError;
}

function getConvexUrl() {
	const url =
		process.env.CONVEX_URL ??
		process.env.CONVEX_SELF_HOSTED_URL ??
		process.env.VITE_CONVEX_URL;
	if (!url) {
		throw new Error(
			"Falta configurar CONVEX_SELF_HOSTED_URL o VITE_CONVEX_URL.",
		);
	}
	return url;
}

export function createConvexServerClient() {
	return new ConvexHttpClient(getConvexUrl());
}

export async function requireConvexSessionFromRequest(request: Request) {
	const authHeader = request.headers.get("authorization");
	const token = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1];
	if (!token) throw new UnauthorizedError();

	const client = createConvexServerClient();
	client.setAuth(token);
	const user = await client.query(convexApi.users.current, {});
	if (!user) throw new UnauthorizedError();
	return user;
}

export async function requireReadingIntegrationOwner(request: Request) {
	const user = await requireConvexSessionFromRequest(request);
	const ownerId = process.env.READING_INTEGRATION_OWNER_ID;
	if (!ownerId) throw new IntegrationOwnerNotConfiguredError();
	if (user._id !== ownerId) throw new ForbiddenIntegrationError();
	return user;
}
