import { loadEnvFile } from "node:process";
import { defineConfig } from "drizzle-kit";

loadEnvFile(".env.local");
loadEnvFile(".env");

const databaseUrl =
	process.env.DATABASE_URL ??
	(process.env.NODE_ENV !== "production"
		? "postgres://postgres:postgres@127.0.0.1:5432/library"
		: undefined);

if (!databaseUrl) {
	throw new Error("Falta DATABASE_URL para Drizzle.");
}

export default defineConfig({
	schema: "./src/db/schema.ts",
	out: "./drizzle",
	dialect: "postgresql",
	dbCredentials: {
		url: databaseUrl,
	},
});
