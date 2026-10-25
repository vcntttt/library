export const streamingPlatforms = [
	"Netflix",
	"Amazon Prime Video",
	"Disney Plus",
	"Max",
	"Apple TV",
	"Paramount Plus",
	"MUBI",
	"Crunchyroll",
	"Universal Plus",
] as const;

const aliases: Record<string, string> = {
	"hbo max": "max",
	"amazon prime video": "prime video",
	"amazon video": "prime video",
	"apple tv plus": "apple tv",
};

function platformKey(name: string) {
	const key = name
		.trim()
		.toLowerCase()
		.replace(/\+/g, " plus")
		.replace(/\s+/g, " ");
	return aliases[key] ?? key;
}

export function getAccessiblePlatforms(
	available: string[] | undefined,
	selected: string[],
) {
	const keys = new Set(selected.map(platformKey));
	return [...new Set(available ?? [])].filter((name) =>
		keys.has(platformKey(name)),
	);
}
