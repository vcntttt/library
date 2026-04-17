import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db/client";
import { schema } from "@/db/schema";

function getBaseUrl() {
	return (
		process.env.BETTER_AUTH_URL ??
		process.env.VITE_SITE_URL ??
		process.env.SERVER_URL ??
		"http://localhost:3000"
	);
}

function getAuthSecret() {
	const secret = process.env.BETTER_AUTH_SECRET;
	if (secret) {
		return secret;
	}

	if (process.env.NODE_ENV !== "production") {
		return "library-dev-secret-change-me-1234567890";
	}

	throw new Error("Falta BETTER_AUTH_SECRET.");
}

const baseURL = getBaseUrl();

export const auth = betterAuth({
	appName: "Biblioteca",
	baseURL,
	secret: getAuthSecret(),
	database: drizzleAdapter(db, {
		provider: "pg",
		schema,
	}),
	emailAndPassword: {
		enabled: true,
		requireEmailVerification: false,
	},
	advanced: {
		useSecureCookies: baseURL.startsWith("https://"),
	},
});
