const siteUrl = process.env.READING_SYNC_URL ?? process.env.VITE_SITE_URL;
const secret = process.env.READING_SYNC_SECRET;

if (!siteUrl) throw new Error("Falta READING_SYNC_URL o VITE_SITE_URL.");
if (!secret) throw new Error("Falta READING_SYNC_SECRET.");

const response = await fetch(
	`${siteUrl.replace(/\/$/, "")}/api/internal/reading/sync`,
	{
		method: "POST",
		headers: { "x-reading-sync-secret": secret },
	},
);
const payload = await response.json().catch(() => ({}));
if (!response.ok) {
	throw new Error(
		typeof payload?.error === "string"
			? payload.error
			: `El sync de lectura falló (${response.status}).`,
	);
}

console.log(JSON.stringify(payload));

export {};
