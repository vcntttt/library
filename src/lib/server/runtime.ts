import { ensureMangaReleaseWorkerStarted } from "./notifications";

declare global {
	var __libraryRuntimeStarted: boolean | undefined;
}

export function ensureAppRuntimeStarted() {
	if (typeof window !== "undefined") return;
	if (process.env.NODE_ENV === "test") return;
	if (globalThis.__libraryRuntimeStarted) return;

	globalThis.__libraryRuntimeStarted = true;
	ensureMangaReleaseWorkerStarted();
}
