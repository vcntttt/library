import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { schema } from "./schema";

declare global {
	var __libraryPgPool: Pool | undefined;
}

function getDatabaseUrl() {
	const databaseUrl = process.env.DATABASE_URL;
	if (databaseUrl) {
		return databaseUrl;
	}

	if (process.env.NODE_ENV !== "production") {
		return "postgres://postgres:postgres@127.0.0.1:5432/library";
	}

	if (!databaseUrl) {
		throw new Error("Falta DATABASE_URL.");
	}

	return databaseUrl;
}

const pool =
	globalThis.__libraryPgPool ??
	new Pool({
		connectionString: getDatabaseUrl(),
	});

if (process.env.NODE_ENV !== "production") {
	globalThis.__libraryPgPool = pool;
}

export { pool };

export const db = drizzle(pool, { schema });
