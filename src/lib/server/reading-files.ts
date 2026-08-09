import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import { basename, dirname, extname, relative, resolve } from "node:path";
import {
	parseReadingSidecars,
	type ReadingAnnotationSnapshot,
	type ReadingFormat,
	type ReadingProgressSnapshot,
} from "@/lib/reading/sidecars";

const readableExtensions = new Set([".epub", ".pdf", ".azw3", ".mobi"]);
const DEFAULT_MAX_FILES = 500;
const DEFAULT_STABILITY_WINDOW_MS = 200;

export interface ReadingFilePayload {
	sourceKey: string;
	sourcePath: string;
	title: string;
	author?: string;
	format: ReadingFormat;
	documentKey: string;
	fileHash: string;
	fileModifiedAt: number;
	sidecarModifiedAt?: number;
	annotationsComplete: boolean;
	progress: ReadingProgressSnapshot[];
	annotations: ReadingAnnotationSnapshot[];
}

export interface ReadingKnownSource {
	sourceKey: string;
	fileModifiedAt?: number;
	sidecarModifiedAt?: number;
	fileHash?: string;
	status?: "active" | "missing" | "error";
}

export interface ReadingScanError {
	path: string;
	message: string;
}

export interface ReadingScanResult {
	files: ReadingFilePayload[];
	skipped: string[];
	errors: ReadingScanError[];
	observedSourceKeys: string[];
	truncated: boolean;
}

export async function scanReadingBooks(
	rootPath: string,
	options: {
		knownSources?: ReadingKnownSource[];
		stabilityWindowMs?: number;
	} = {},
) {
	const result = await scanReadingBooksDetailed(rootPath, options);
	return result.files;
}

export async function scanReadingBooksDetailed(
	rootPath: string,
	options: {
		knownSources?: ReadingKnownSource[];
		stabilityWindowMs?: number;
	} = {},
): Promise<ReadingScanResult> {
	const root = resolve(rootPath);
	const bookPaths = await findBookPaths(root);
	const maxFiles = parseLimit(process.env.READING_SYNC_MAX_FILES);
	const limitedPaths = bookPaths.slice(0, maxFiles);
	const knownSources = new Map(
		(options.knownSources ?? []).map((source) => [source.sourceKey, source]),
	);
	const result: ReadingScanResult = {
		files: [],
		skipped: [],
		errors: [],
		observedSourceKeys: [],
		truncated: bookPaths.length > limitedPaths.length,
	};

	await Promise.all(
		limitedPaths.map(async (bookPath) => {
			const sourceKey = relative(root, bookPath).split("\\").join("/");
			result.observedSourceKeys.push(sourceKey);
			try {
				const quickStats = await inspectBook(bookPath);
				const sidecarPath = getSidecarPath(bookPath);
				const sidecarStats = await inspectOptionalFile(sidecarPath);
				const known = knownSources.get(sourceKey);
				if (
					known &&
					known.status !== "error" &&
					known.fileModifiedAt === quickStats.mtimeMs &&
					known.sidecarModifiedAt === sidecarStats?.mtimeMs
				) {
					result.skipped.push(sourceKey);
					return;
				}

				result.files.push(
					await readBookPayload(root, bookPath, {
						stabilityWindowMs: options.stabilityWindowMs,
					}),
				);
			} catch (error) {
				result.errors.push({
					path: sourceKey,
					message:
						error instanceof Error
							? error.message
							: "No se pudo leer el archivo de lectura.",
				});
			}
		}),
	);

	result.files.sort((left, right) =>
		left.sourceKey.localeCompare(right.sourceKey),
	);
	result.skipped.sort((left, right) => left.localeCompare(right));
	result.observedSourceKeys.sort((left, right) => left.localeCompare(right));
	result.errors.sort((left, right) => left.path.localeCompare(right.path));
	return result;
}

async function findBookPaths(root: string): Promise<string[]> {
	const entries = await readdir(root, { withFileTypes: true });
	const paths: string[] = [];

	for (const entry of entries) {
		if (entry.name === ".stfolder" || entry.name.startsWith(".")) continue;
		const entryPath = resolve(root, entry.name);
		if (entry.isDirectory()) {
			paths.push(...(await findBookPaths(entryPath)));
			continue;
		}

		if (readableExtensions.has(extname(entry.name).toLowerCase())) {
			paths.push(entryPath);
		}
	}

	return paths.sort((left, right) => left.localeCompare(right));
}

async function readBookPayload(
	root: string,
	bookPath: string,
	options: { stabilityWindowMs?: number },
): Promise<ReadingFilePayload> {
	const fileStats = await readStableFile(bookPath, options.stabilityWindowMs);
	const file = await readFile(bookPath);
	const sourcePath = relative(root, bookPath).split("\\").join("/");
	const sourceKey = sourcePath;
	const sidecarPath = getSidecarPath(bookPath);
	const metadata = await readSidecarText(
		sidecarPath,
		options.stabilityWindowMs,
	);
	const parsed = parseReadingSidecars({
		sourceKey,
		title: basename(bookPath, extname(bookPath)),
		format: formatFromExtension(extname(bookPath)),
		metadata: metadata?.value,
		metadataSourceTimestamp: metadata?.modifiedAt,
	});

	return {
		...parsed.document,
		sourcePath,
		documentKey: createHash("sha256").update(file).digest("hex"),
		fileHash: createHash("sha256").update(file).digest("hex"),
		fileModifiedAt: fileStats.mtimeMs,
		sidecarModifiedAt: metadata?.modifiedAt,
		annotationsComplete: metadata !== undefined,
		progress: parsed.progress,
		annotations: parsed.annotations,
	};
}

function getSidecarPath(bookPath: string) {
	const extension = extname(bookPath).toLowerCase();
	return `${resolve(
		dirname(bookPath),
		`${basename(bookPath, extname(bookPath))}.sdr`,
	)}/metadata${extension}.lua`;
}

async function readSidecarText(path: string, stabilityWindowMs?: number) {
	const fileStats = await inspectOptionalFile(path);
	if (!fileStats) return undefined;

	await ensureStable(path, fileStats, stabilityWindowMs);
	try {
		return {
			value: await readFile(path, "utf8"),
			modifiedAt: fileStats.mtimeMs,
		};
	} catch (error) {
		throw new Error(`No se pudo leer el sidecar ${path}.`, { cause: error });
	}
}

async function readStableFile(path: string, stabilityWindowMs?: number) {
	const initial = await stat(path);
	await ensureStable(path, initial, stabilityWindowMs);
	return initial;
}

async function ensureStable(
	path: string,
	initial: { size: number; mtimeMs: number },
	stabilityWindowMs?: number,
) {
	const windowMs = normalizeStabilityWindow(stabilityWindowMs);
	if (windowMs === 0) return;
	await new Promise((resolvePromise) => setTimeout(resolvePromise, windowMs));
	const current = await stat(path);
	if (current.size !== initial.size || current.mtimeMs !== initial.mtimeMs) {
		throw new Error(
			"El archivo cambió mientras se sincronizaba; se reintentará.",
		);
	}
}

async function inspectBook(path: string) {
	return stat(path);
}

async function inspectOptionalFile(path: string) {
	try {
		return await stat(path);
	} catch (error) {
		if (isNotFound(error)) return undefined;
		throw error;
	}
}

function formatFromExtension(extension: string): ReadingFormat {
	if (extension.toLowerCase() === ".epub") return "epub";
	if (extension.toLowerCase() === ".pdf") return "pdf";
	return "other";
}

function parseLimit(value: string | undefined) {
	const parsed = Number(value);
	if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_MAX_FILES;
	return Math.min(5000, Math.floor(parsed));
}

function normalizeStabilityWindow(value: number | undefined) {
	if (value !== undefined) return Math.max(0, Math.floor(value));
	const configured = Number(process.env.READING_SYNC_STABILITY_WINDOW_MS);
	if (Number.isFinite(configured) && configured >= 0) return configured;
	return DEFAULT_STABILITY_WINDOW_MS;
}

function isNotFound(error: unknown) {
	return (
		typeof error === "object" &&
		error !== null &&
		"code" in error &&
		error.code === "ENOENT"
	);
}
