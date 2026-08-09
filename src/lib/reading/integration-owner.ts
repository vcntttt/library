import { getAuthUserId } from "@convex-dev/auth/server";

type AuthCtx = Parameters<typeof getAuthUserId>[0];

export async function isIntegrationOwner(ctx: AuthCtx) {
	const userId = await getAuthUserId(ctx);
	const configuredOwnerId = process.env.READING_INTEGRATION_OWNER_ID?.trim();
	return Boolean(userId && configuredOwnerId && configuredOwnerId === userId);
}

export async function requireIntegrationOwner(ctx: AuthCtx) {
	const userId = await getAuthUserId(ctx);
	const configuredOwnerId = process.env.READING_INTEGRATION_OWNER_ID?.trim();
	if (!userId || !configuredOwnerId || configuredOwnerId !== userId) {
		throw new Error("No autorizado.");
	}
	return userId;
}
