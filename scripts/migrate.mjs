import { migrate } from "drizzle-orm/node-postgres/migrator";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
	throw new Error("Falta DATABASE_URL.");
}

const pool = new Pool({
	connectionString: databaseUrl,
});

try {
	const db = drizzle(pool);
	await migrate(db, {
		migrationsFolder: "./drizzle",
	});
	console.log("[migrate] Drizzle migrations applied successfully.");
} finally {
	await pool.end();
}
